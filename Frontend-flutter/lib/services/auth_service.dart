import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class AuthService {
  static const _baseUrl = 'http://localhost:3001'; // Ajuste conforme necessário
  final _storage = const FlutterSecureStorage();

  Future<Map<String, dynamic>> cadastro({
    required String nome,
    required String sobrenome,
    required String email,
    required String telefone,
    required String cpf,
    required String senha,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/api/auth/cadastro'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'nome': nome,
        'sobrenome': sobrenome,
        'email': email,
        'telefone': telefone,
        'cpf': cpf,
        'senha': senha,
      }),
    );
    try {
      final data = jsonDecode(response.body);
      return {
        'success': response.statusCode == 201,
        'message': data['message'] ?? 'Erro desconhecido',
      };
    } catch (_) {
      return {
        'success': false,
        'message': 'Erro de conexão ou resposta inválida',
      };
    }
  }

  Future<void> logout() async {
    await _storage.delete(key: 'token');
  }

  Future<String?> getToken() async {
    return await _storage.read(key: 'token');
  }
}
