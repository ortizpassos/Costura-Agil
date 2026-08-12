import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/user.dart';

class UserService {
  static const _baseUrl = 'http://localhost:3000'; // Ajuste conforme necessário

  Future<User?> getUser(String token) async {
    final response = await http.get(
      Uri.parse('$_baseUrl/api/auth/me'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );
    if (response.statusCode == 200) {
      return User.fromJson(jsonDecode(response.body));
    }
    return null;
  }
}
