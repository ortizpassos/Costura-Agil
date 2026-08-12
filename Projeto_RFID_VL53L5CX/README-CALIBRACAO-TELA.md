# Tela de processo de calibração

Fluxo implementado:

1. Tela "Calibração do Sensor"
2. Usuário toca em CALIBRAR
3. Abre a tela "Calibrando sensor"
4. Contagem regressiva 3 / 2 / 1
5. Barra de progresso ligada às 30 amostras reais do VL53L5CX
6. Status "Amostra X/30" em tempo real
7. Resultado final permanece na tela
   - sucesso: CONTINUAR
   - falha: TENTAR NOVAMENTE

A calibração continua mantendo LVGL e Socket.IO atendidos durante o processo.
