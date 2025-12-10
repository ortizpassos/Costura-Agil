import 'package:flutter/material.dart';
import 'auth_service.dart';

class AuthGuard extends StatelessWidget {
  final Widget child;
  const AuthGuard({Key? key, required this.child}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String?>(
      future: AuthService().getToken(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.data == null) {
          Future.microtask(() => Navigator.of(context).pushReplacementNamed('/login'));
          return const SizedBox.shrink();
        }
        return child;
      },
    );
  }
}
