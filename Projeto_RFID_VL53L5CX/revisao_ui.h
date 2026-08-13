#pragma once
#include <Arduino.h>
void revisaoUI_pronto(const String& codigo, const String& nome, int revisadas, int total);
void revisaoUI_lendo();
void revisaoUI_atualizarLeitura(int quantidadeEpcs);
void revisaoUI_validando(const char* mensagem);
void revisaoUI_aprovada(int revisadas, int total);
void revisaoUI_reprovada(const String& motivo);
void revisaoUI_semEtiqueta();
void revisaoUI_multiplas(int quantidade);
void revisaoUI_semConexao();
