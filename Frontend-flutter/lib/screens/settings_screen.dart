import 'package:flutter/material.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Configurações'),
        backgroundColor: Colors.blue,
      ),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.person),
            title: const Text('Perfil'),
            subtitle: const Text('Gerenciar informações do usuário'),
            onTap: () {
              // Navegar para tela de perfil
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Perfil - Em desenvolvimento')),
              );
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.notifications),
            title: const Text('Notificações'),
            subtitle: const Text('Configurar alertas e notificações'),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Notificações - Em desenvolvimento')),
              );
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.palette),
            title: const Text('Tema'),
            subtitle: const Text('Alterar aparência do aplicativo'),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Tema - Em desenvolvimento')),
              );
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.language),
            title: const Text('Idioma'),
            subtitle: const Text('Selecionar idioma do aplicativo'),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Idioma - Em desenvolvimento')),
              );
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.info),
            title: const Text('Sobre'),
            subtitle: const Text('Informações sobre o aplicativo'),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Sobre - Em desenvolvimento')),
              );
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout),
            title: const Text('Sair'),
            subtitle: const Text('Fazer logout da conta'),
            onTap: () {
              // Implementar logout
              Navigator.of(context).pushReplacementNamed('/login');
            },
          ),
        ],
      ),
    );
  }
}