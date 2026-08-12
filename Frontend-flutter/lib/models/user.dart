class User {
  final String id;
  final String nome;
  final String email;

  User({required this.id, required this.nome, required this.email});

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['_id'] ?? '',
      nome: json['nome'] ?? '',
      email: json['email'] ?? '',
    );
  }
}
