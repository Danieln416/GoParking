/*
 * ============================================================
 * GoParking — Firmware de Control de Barrera / Puerta con ESP32
 * ============================================================
 * 
 * Este programa consulta continuamente el estado del sistema GoParking
 * a través de la API REST segura (Cloudflare Worker + D1).
 * 
 * Flujo de Operación:
 * 1. Conexión WiFi con autoreconexión en caso de desconexión.
 * 2. Cada 1 segundo realiza una petición HTTPS: GET /api/puerta/estado
 *    enviando el Token Secreto en la cabecera 'x-door-token'.
 * 3. Si la API responde con estado "PENDIENTE_ABRIR" y acción "ACTIVAR_RELE":
 *    - Activa el Pin del Relé durante el tiempo solicitado (5000 ms por defecto).
 *    - Apaga el Pin del Relé.
 *    - Notifica a la API con POST /api/puerta/confirmar indicando el comando_id.
 * 
 * Requisitos de Librerías (Instalar desde el Gestor de Bibliotecas de Arduino):
 * - ArduinoJson (versión 6.x o 7.x por Benoit Blanchon)
 * 
 * Placa recomendada en Arduino IDE: "DOIT ESP32 DEVKIT V1" o "ESP32 Dev Module"
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ============================================================
// CONFIGURACIÓN DE RED WIFI
// ============================================================
const char* WIFI_SSID     = "TU_RED_WIFI";
const char* WIFI_PASSWORD = "TU_CONTRASENA_WIFI";

// ============================================================
// CONFIGURACIÓN DE LA API Y SEGURIDAD GOPARKING
// ============================================================
// URL de tu API GoParking (sin barra final)
const char* API_BASE_URL  = "https://goparking-api.daniram-parking.workers.dev";

// Token secreto configurado en el panel administrativo de GoParking
const char* DEVICE_TOKEN  = "goparking_esp32_sec_2026";

// Identificador único de este dispositivo físico
const char* DEVICE_ID     = "ESP32_BARRERA_ENTRADA_1";

// ============================================================
// CONFIGURACIÓN DE HARDWARE (PINES)
// ============================================================
// Pin GPIO conectado a la señal del módulo Relé
const int PIN_RELE = 23;

// Pin del LED onboard para estado visual (GPIO 2 en DevKit)
const int PIN_LED  = 2;

// Tipo de activación del relé:
// La mayoría de módulos relé para Arduino/ESP32 se activan con nivel BAJO (LOW).
// Si tu módulo es activo en ALTO, cambia RELAY_ACTIVE a HIGH y RELAY_INACTIVE a LOW.
const int RELAY_ACTIVE   = LOW;
const int RELAY_INACTIVE = HIGH;

// Intervalo de consulta a la API (en milisegundos)
const unsigned long POLL_INTERVAL_MS = 1000;
unsigned long lastPollTime = 0;

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

void conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("\n[WiFi] Conectando a: " + String(WIFI_SSID));
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(PIN_LED, !digitalRead(PIN_LED));
    intentos++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(PIN_LED, HIGH);
    Serial.println("\n[WiFi] Conectado exitosamente!");
    Serial.print("[WiFi] Direccion IP local: ");
    Serial.println(WiFi.localIP());
  } else {
    digitalWrite(PIN_LED, LOW);
    Serial.println("\n[WiFi] No se pudo conectar a la red. Reintentando...");
  }
}

void accionarRele(int duracionMs) {
  if (duracionMs <= 0 || duracionMs > 15000) {
    duracionMs = 5000; // Valor seguro por defecto (5 segundos)
  }

  Serial.println("\n========================================");
  Serial.printf("[BARRERA] >> ACTIVANDO RELE DURANTE %d ms <<\n", duracionMs);
  Serial.println("========================================");

  // Activar pulso de apertura
  digitalWrite(PIN_RELE, RELAY_ACTIVE);
  digitalWrite(PIN_LED, HIGH);

  delay(duracionMs);

  // Volver a estado inactivo
  digitalWrite(PIN_RELE, RELAY_INACTIVE);
  digitalWrite(PIN_LED, LOW);

  Serial.println("[BARRERA] >> CICLO COMPLETADO: RELE DESACTIVADO <<");
}

void confirmarApertura(const char* comandoId) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure(); // Para HTTPS sin validar certificados locales

  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/puerta/confirmar";

  Serial.print("[HTTP] Confirmando orden con API: ");
  Serial.println(url);

  if (http.begin(client, url)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-door-token", DEVICE_TOKEN);

    StaticJsonDocument<256> doc;
    doc["comando_id"]     = comandoId;
    doc["dispositivo_id"] = DEVICE_ID;
    doc["ip_local"]       = WiFi.localIP().toString();
    doc["rssi"]           = WiFi.RSSI();

    String requestBody;
    serializeJson(doc, requestBody);

    int httpCode = http.POST(requestBody);
    if (httpCode > 0) {
      String response = http.getString();
      Serial.printf("[HTTP] Respuesta confirmacion [%d]: %s\n", httpCode, response.c_str());
    } else {
      Serial.printf("[HTTP] Error confirmando: %s\n", http.errorToString(httpCode).c_str());
    }
    http.end();
  }
}

void consultarEstadoPuerta() {
  if (WiFi.status() != WL_CONNECTED) {
    conectarWiFi();
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/puerta/estado";

  if (http.begin(client, url)) {
    http.addHeader("x-door-token", DEVICE_TOKEN);
    http.setTimeout(3500);

    int httpCode = http.GET();
    if (httpCode == 200) {
      String payload = http.getString();
      
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        const char* estado = doc["estado"] | "EN_ESPERA";
        const char* accion = doc["accion"] | "NINGUNA";

        if (String(estado) == "PENDIENTE_ABRIR" && String(accion) == "ACTIVAR_RELE") {
          const char* comandoId = doc["comando_id"] | "";
          int pulsoMs = doc["tiempo_pulso_ms"] | 5000;
          const char* usuario = doc["solicitado_por"] | "Usuario";

          Serial.println("\n[ORDEN RECIBIDA]");
          Serial.printf("  Comando ID: %s\n", comandoId);
          Serial.printf("  Solicitado por: %s\n", usuario);
          Serial.printf("  Pulso rele: %d ms\n", pulsoMs);

          // Ejecutar ciclo del relé
          accionarRele(pulsoMs);

          // Avisar a la API que el ciclo ya terminó
          confirmarApertura(comandoId);
        }
      }
    } else if (httpCode == 401) {
      Serial.println("[ERROR 401] Token no autorizado! Verifica DEVICE_TOKEN con el configurado en GoParking.");
    } else if (httpCode > 0) {
      // Otros códigos (ej. 500, etc.)
      // Serial.printf("[HTTP] Estado: %d\n", httpCode);
    }
    http.end();
  }
}

// ============================================================
// SETUP Y LOOP
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==================================================");
  Serial.println("  GoParking — Sistema de Apertura Vehicular ESP32 ");
  Serial.println("==================================================");

  pinMode(PIN_RELE, OUTPUT);
  pinMode(PIN_LED, OUTPUT);

  // Asegurar que el relé inicie apagado
  digitalWrite(PIN_RELE, RELAY_INACTIVE);
  digitalWrite(PIN_LED, LOW);

  conectarWiFi();
}

void loop() {
  // Manejo de reconexión WiFi si se desconecta
  if (WiFi.status() != WL_CONNECTED) {
    conectarWiFi();
  }

  // Consultar estado cada 1 segundo sin bloquear el procesador
  unsigned long now = millis();
  if (now - lastPollTime >= POLL_INTERVAL_MS) {
    lastPollTime = now;
    consultarEstadoPuerta();
  }
}
