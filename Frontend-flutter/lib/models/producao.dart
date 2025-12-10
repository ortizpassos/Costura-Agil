class Producao {
  final String id;
  final String descricao;
  final int quantidade;

  Producao({required this.id, required this.descricao, required this.quantidade});

  factory Producao.fromJson(Map<String, dynamic> json) {
    return Producao(
      id: json['_id'] ?? '',
      descricao: json['descricao'] ?? '',
      quantidade: json['quantidade'] ?? 0,
    );
  }
}
