
import { Injectable } from '@angular/core';
import * as io from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: any;
  private apiUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://monitor-ellas-backend.onrender.com';

  constructor() {
  this.socket = io.default(this.apiUrl);
  }

  onDeviceStatusUpdate(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('deviceStatusUpdate', (data: any) => {
        observer.next(data);
      });
    });
  }

  onProductionUpdate(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('productionUpdate', (data: any) => {
        observer.next(data);
      });
    });
  }

  disconnect() {
    this.socket.disconnect();
  }
}
