#pragma once
#include <Arduino.h>

void revisaoRFID_begin();
void revisaoRFID_atualizar();
void revisaoRFID_definirArtigo(const String& artigoId, const String& codigo, const String& nome, int quantidade, int revisadas);
void revisaoRFID_limparArtigo();
void revisaoRFID_onValidacao(const String& resultado);
void revisaoRFID_onConfirmacao(bool success, const String& resultado, int revisadas, int total);
bool revisaoRFID_ativa();
