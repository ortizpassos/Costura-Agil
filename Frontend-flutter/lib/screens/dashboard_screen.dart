import 'package:flutter/material.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        backgroundColor: Colors.blue,
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const DrawerHeader(
              decoration: BoxDecoration(
                color: Colors.blue,
              ),
              child: Text(
                'Menu',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                ),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.home),
              title: const Text('Home'),
              onTap: () {
                Navigator.of(context).pushReplacementNamed('/');
              },
            ),
            ListTile(
              leading: const Icon(Icons.dashboard),
              title: const Text('Dashboard'),
              onTap: () {
                Navigator.of(context).pop();
              },
            ),
            ListTile(
              leading: const Icon(Icons.production_quantity_limits),
              title: const Text('Produção'),
              onTap: () {
                Navigator.of(context).pushReplacementNamed('/producao');
              },
            ),
            ListTile(
              leading: const Icon(Icons.devices),
              title: const Text('Dispositivos'),
              onTap: () {
                Navigator.of(context).pushReplacementNamed('/display');
              },
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.settings),
              title: const Text('Configurações'),
              onTap: () {
                Navigator.of(context).pushNamed('/settings');
              },
            ),
            ListTile(
              leading: const Icon(Icons.logout),
              title: const Text('Sair'),
              onTap: () {
                Navigator.of(context).pushReplacementNamed('/login');
              },
            ),
          ],
        ),
      ),
      body: const Center(
        child: Text('Bem-vindo ao Dashboard!', style: TextStyle(fontSize: 24)),
      ),
    );
  }
}
