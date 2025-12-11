import { Injectable } from '@angular/core';
import * as ioClient from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: SocketIOClient.Socket;

  constructor() {
    const socketUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : 'https://monitor-ellas-backend.onrender.com';
    this.socket = ioClient.connect(socketUrl);
  }

  onDeviceStatusUpdate(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('deviceStatusUpdate', (data: any) => {
        observer.next(data);
      });
      return () => this.socket.off('deviceStatusUpdate');
    });
  }

  onProductionUpdate(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('productionUpdate', (payload: any) => {
        observer.next(payload);
      });
      return () => this.socket.off('productionUpdate');
    });
  }
}
