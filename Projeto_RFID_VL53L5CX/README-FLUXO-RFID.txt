DISPOSITIVO DE REVISAO DO ARCO - FLUXO FINAL
============================================

Mantido:
- WiFiManager
- HTTPS/WSS monitor-ellas-backend.onrender.com:443
- ativacao PIX
- token permanente
- login
- tela/calibracao VL53L5CX
- YRM1001 em GPIO16/17, 115200

Novo fluxo apos login:
1. solicitarArtigosRFID
2. mostra somente artigos RFID completos e em producao
3. operador escolhe o artigo
4. tela PRONTO PARA REVISAO
5. VL53L5CX detecta entrada da peca
6. YRM1001 inicia inventario
7. EPCs diferentes sao contados apenas para a peca atual
8. primeiro EPC e validado na API, sem confirmar revisao
9. ao sair do arco:
   - 0 EPC: SEM ETIQUETA + beep de erro
   - >1 EPC: MULTIPLAS ETIQUETAS + beep de erro
   - 1 EPC invalido: REPROVADA + beep de erro
   - 1 EPC valido: envia confirmarRevisaoRFID
10. somente apos resposta de confirmacao:
   - PECA APROVADA + 2 beeps

TIMEOUT API:
6 segundos. Se a peca sair antes da resposta, o dispositivo aguarda a resposta antes de classificar.

BEEPS:
O codigo usa a funcao beepSensor() ja existente no projeto:
- aprovada: beepSensor(2)
- reprovada: beepSensor(3)
- sem etiqueta: beepSensor(3)
- multiplas: beepSensor(4)

OBSERVACAO:
Na base atual, beepSensor imprime BEEP na Serial e e o ponto de integracao do buzzer.
Se seu hardware usa um GPIO/buzzer fisico, mantenha a implementacao fisica dentro dessa mesma funcao.
