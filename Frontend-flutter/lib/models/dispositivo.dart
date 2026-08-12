class Dispositivo {
  final String id;
  final String nome;
  final String tipo;

  Dispositivo({required this.id, required this.nome, required this.tipo});

  factory Dispositivo.fromJson(Map<String, dynamic> json) {
    return Dispositivo(
      id: json['_id'] ?? '',
      nome: json['nome'] ?? '',
      tipo: json['tipo'] ?? '',
    );
  }
}
