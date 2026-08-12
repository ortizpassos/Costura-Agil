
import 'package:flutter/material.dart';
import '../services/auth_service.dart';

class CadastroScreen extends StatefulWidget {
  const CadastroScreen({Key? key}) : super(key: key);

  @override
  State<CadastroScreen> createState() => _CadastroScreenState();
}

class _CadastroScreenState extends State<CadastroScreen> {
  final AuthService _authService = AuthService();
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _firstNameController = TextEditingController();
  final TextEditingController _lastNameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _cpfController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();
  bool _showPassword = false;
  bool _showConfirmPassword = false;
  bool _acceptTerms = false;
  bool _isLoading = false;
  String? _errorMessage;
  String? _successMessage;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: [Color(0xFF00C853), Color(0xFF2196F3)],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            child: Card(
              elevation: 8,
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 32),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_errorMessage != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8.0),
                          child: Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
                        ),
                      if (_successMessage != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8.0),
                          child: Text(_successMessage!, style: const TextStyle(color: Colors.green)),
                        ),
                      Text('Cadastro', style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
                      const SizedBox(height: 8),
                      const Text('Faça seu cadastro e controle sua produtividade', textAlign: TextAlign.center),
                      const SizedBox(height: 24),
                      // Dados Pessoais
                      Container(
                        alignment: Alignment.centerLeft,
                        child: const Text('Dados Pessoais', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _firstNameController,
                              decoration: const InputDecoration(
                                labelText: 'Nome *',
                                border: OutlineInputBorder(),
                              ),
                              validator: (v) => v == null || v.trim().isEmpty ? 'Informe o nome' : null,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _lastNameController,
                              decoration: const InputDecoration(
                                labelText: 'Sobrenome *',
                                border: OutlineInputBorder(),
                              ),
                              validator: (v) => v == null || v.trim().isEmpty ? 'Informe o sobrenome' : null,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _emailController,
                        decoration: const InputDecoration(
                          labelText: 'Email *',
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.emailAddress,
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) return 'Informe o email';
                          if (!RegExp(r'^.+@.+\..+').hasMatch(v)) return 'Email inválido';
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _phoneController,
                              decoration: const InputDecoration(
                                labelText: 'Telefone',
                                border: OutlineInputBorder(),
                              ),
                              keyboardType: TextInputType.phone,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _cpfController,
                              decoration: const InputDecoration(
                                labelText: 'CPF',
                                border: OutlineInputBorder(),
                              ),
                              keyboardType: TextInputType.number,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      // Dados de Acesso
                      Container(
                        alignment: Alignment.centerLeft,
                        child: const Text('Dados de Acesso', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: !_showPassword,
                        decoration: InputDecoration(
                          labelText: 'Senha *',
                          border: const OutlineInputBorder(),
                          suffixIcon: IconButton(
                            icon: Icon(_showPassword ? Icons.visibility_off : Icons.visibility),
                            onPressed: () => setState(() => _showPassword = !_showPassword),
                          ),
                        ),
                        validator: (v) => v == null || v.length < 6 ? 'Mínimo 6 caracteres' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _confirmPasswordController,
                        obscureText: !_showConfirmPassword,
                        decoration: InputDecoration(
                          labelText: 'Confirmar senha *',
                          border: const OutlineInputBorder(),
                          suffixIcon: IconButton(
                            icon: Icon(_showConfirmPassword ? Icons.visibility_off : Icons.visibility),
                            onPressed: () => setState(() => _showConfirmPassword = !_showConfirmPassword),
                          ),
                        ),
                        validator: (v) => v != _passwordController.text ? 'Senhas não conferem' : null,
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Checkbox(
                            value: _acceptTerms,
                            onChanged: (v) => setState(() => _acceptTerms = v ?? false),
                          ),
                          const Expanded(
                            child: Text.rich(
                              TextSpan(
                                text: 'Aceito os ',
                                children: [
                                  TextSpan(
                                    text: 'Termos de Uso',
                                    style: TextStyle(decoration: TextDecoration.underline),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _isLoading || !_acceptTerms ? null : _cadastrar,
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: _isLoading
                              ? const CircularProgressIndicator(color: Colors.white)
                              : const Text('Cadastrar', style: TextStyle(fontSize: 16)),
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: () {
                            Navigator.pop(context);
                          },
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: const Text('Já tenho conta', style: TextStyle(fontSize: 16)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.only(bottom: 16.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Text('🇧🇷 Português | English'),
          ],
        ),
      ),
    );
  }

  void _cadastrar() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });
    final result = await _authService.cadastro(
      nome: _firstNameController.text.trim(),
      sobrenome: _lastNameController.text.trim(),
      email: _emailController.text.trim(),
      telefone: _phoneController.text.trim(),
      cpf: _cpfController.text.trim(),
      senha: _passwordController.text,
    );
    setState(() {
      _isLoading = false;
      if (result['success'] == true) {
        _successMessage = 'Cadastro realizado com sucesso!';
        Future.delayed(const Duration(seconds: 2), () {
          Navigator.pop(context);
        });
      } else {
        _errorMessage = result['message'] ?? 'Erro ao cadastrar';
      }
    });
  }
}
