#!/bin/bash

ANDROID_HOME="$HOME/Library/Android/sdk"
EMULATOR="$ANDROID_HOME/emulator/emulator"
ADB="$ANDROID_HOME/platform-tools/adb"
AVD_NAME="pixel_5_-_api_33"
MOBILE_DIR="$(dirname "$0")/../packages/mobile"

export ANDROID_HOME
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

# Tue tout ce qui pourrait bloquer
echo "[ANDROID] Nettoyage des processus existants..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "qemu-system" 2>/dev/null || true
sleep 2

# Libère le port 8081 si occupé
PORT_PID=$(lsof -ti :8081 2>/dev/null)
if [ -n "$PORT_PID" ]; then
  echo "[ANDROID] Port 8081 occupé (PID $PORT_PID), kill..."
  kill -9 $PORT_PID 2>/dev/null || true
  sleep 1
fi

echo "[ANDROID] Démarrage de l'émulateur $AVD_NAME..."
"$EMULATOR" -avd "$AVD_NAME" -no-snapshot-load &

echo "[ANDROID] Attente de la détection par adb..."
until "$ADB" devices | grep -q "emulator"; do
  sleep 2
done

EMULATOR_ID=$("$ADB" devices | grep "emulator" | awk '{print $1}' | head -1)
echo "[ANDROID] Émulateur détecté : $EMULATOR_ID"

echo "[ANDROID] Attente du boot complet..."
until "$ADB" -s "$EMULATOR_ID" shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; do
  sleep 2
done

echo "[ANDROID] ✅ Boot complet ! Lancement de l'app..."

cd "$MOBILE_DIR"
export ANDROID_SERIAL="$EMULATOR_ID"
export REACT_NATIVE_PACKAGER_HOSTNAME=10.0.2.2
npx expo start --android
