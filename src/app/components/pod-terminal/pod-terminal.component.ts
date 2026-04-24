import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { KubernetesService } from '../../services/kubernetes.service';
import { ElectronService } from '../../services/electron.service';

@Component({
  selector: 'app-pod-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="terminal-drawer-overlay" [class.show]="isOpen" (click)="onOverlayClick($event)">
      <div class="terminal-drawer-panel" [class.open]="isOpen"
        [style.width.px]="panelWidth" (click)="$event.stopPropagation()">
        <div class="resize-handle" (mousedown)="startResize($event)"></div>
        <div class="terminal-header d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-terminal-fill text-success"></i>
            <span class="fw-semibold small">{{ podName }}</span>
            <span class="badge bg-secondary-subtle text-secondary-emphasis small">{{ namespace }}</span>
            <select *ngIf="containerNames.length > 1" class="form-select form-select-sm"
              style="width:180px" [(ngModel)]="selectedContainer" (ngModelChange)="reconnect()">
              <option *ngFor="let c of containerNames" [value]="c">{{ c }}</option>
            </select>
            <span *ngIf="containerNames.length <= 1" class="text-muted small">{{ selectedContainer }}</span>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span *ngIf="!connected" class="badge bg-danger small">Disconnected</span>
            <span *ngIf="connected" class="badge bg-success small">Connected</span>
            <button class="btn btn-sm btn-outline-warning" (click)="reconnect()" title="Reconnect">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button class="btn-close btn-close-white" (click)="close()"></button>
          </div>
        </div>
        <div class="terminal-body" #terminalContainer></div>
      </div>
    </div>
  `,
  styles: [`
    .terminal-drawer-overlay {
      position: fixed; inset: 0; z-index: 1060;
      background: rgba(0,0,0,0.4);
      opacity: 0; pointer-events: none;
      transition: opacity 0.25s;
    }
    .terminal-drawer-overlay.show { opacity: 1; pointer-events: all; }

    .terminal-drawer-panel {
      position: fixed; top: 0; right: 0; bottom: 0;
      min-width: 400px; max-width: 90vw;
      background: #11111b;
      color: #cdd6f4;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex; flex-direction: column;
      box-shadow: -4px 0 24px rgba(0,0,0,0.5);
    }
    .terminal-drawer-panel.open { transform: translateX(0); }

    .resize-handle {
      position: absolute; left: -3px; top: 0; bottom: 0; width: 6px;
      cursor: col-resize; z-index: 10;
      background: transparent;
    }
    .resize-handle:hover, .resize-handle:active {
      background: rgba(137, 180, 250, 0.3);
    }

    .terminal-header {
      padding: 0.75rem 1rem;
      background: #181825;
      border-bottom: 1px solid #313244;
      flex-shrink: 0;
    }

    .terminal-body {
      flex: 1; padding: 4px;
      overflow: hidden;
    }
  `]
})
export class PodTerminalComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() isOpen = false;
  @Input() podName = '';
  @Input() namespace = '';
  @Input() contextName = '';
  @Input() containerNames: string[] = [];
  @Output() closed = new EventEmitter<void>();

  @ViewChild('terminalContainer') terminalContainer!: ElementRef<HTMLDivElement>;

  selectedContainer = '';
  connected = false;
  panelWidth = 700;
  private sessionId = '';
  private terminal!: Terminal;
  private fitAddon!: FitAddon;
  private resizing = false;
  private resizeObserver?: ResizeObserver;

  constructor(
    private k8s: KubernetesService,
    private electron: ElectronService
  ) {}

  ngOnInit(): void {
    if (this.containerNames.length > 0) {
      this.selectedContainer = this.containerNames[0];
    }
  }

  ngAfterViewInit(): void {
    this.initTerminal();
    if (this.isOpen) {
      setTimeout(() => this.connect(), 200);
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.terminal?.dispose();
    this.resizeObserver?.disconnect();
    this.electron.removeAllListeners('exec:data');
    this.electron.removeAllListeners('exec:exit');
    this.electron.removeAllListeners('exec:error');
  }

  private initTerminal(): void {
    this.terminal = new Terminal({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 13,
      theme: {
        background: '#11111b',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        selectionBackground: '#45475a',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8',
      }
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(this.terminalContainer.nativeElement);

    setTimeout(() => this.fitAddon.fit(), 50);

    // Send user input to the exec session
    this.terminal.onData((data: string) => {
      if (this.sessionId && this.connected) {
        this.k8s.execInput(this.sessionId, data);
      }
    });

    // Watch for container resize
    this.resizeObserver = new ResizeObserver(() => {
      setTimeout(() => this.fitAddon.fit(), 50);
    });
    this.resizeObserver.observe(this.terminalContainer.nativeElement);

    // Listen for exec data
    this.electron.on('exec:data', (sid: string, data: string) => {
      if (sid === this.sessionId) {
        this.terminal.write(data);
      }
    });
    this.electron.on('exec:exit', (sid: string, code: number | null) => {
      if (sid === this.sessionId) {
        this.connected = false;
        this.terminal.write(`\r\n\x1b[33m--- Session exited (code: ${code}) ---\x1b[0m\r\n`);
      }
    });
    this.electron.on('exec:error', (sid: string, message: string) => {
      if (sid === this.sessionId) {
        this.connected = false;
        this.terminal.write(`\r\n\x1b[31m--- Error: ${message} ---\x1b[0m\r\n`);
      }
    });
  }

  async connect(): Promise<void> {
    this.sessionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.terminal.clear();
    this.terminal.write(`\x1b[36mConnecting to ${this.podName}/${this.selectedContainer}...\x1b[0m\r\n`);

    try {
      await this.k8s.execPod(this.sessionId, this.contextName, this.namespace, this.podName, this.selectedContainer);
      this.connected = true;
    } catch (e: any) {
      this.connected = false;
      this.terminal.write(`\r\n\x1b[31mFailed to connect: ${e.message}\x1b[0m\r\n`);
    }
  }

  disconnect(): void {
    if (this.sessionId) {
      this.k8s.execKill(this.sessionId).catch(() => {});
      this.connected = false;
      this.sessionId = '';
    }
  }

  reconnect(): void {
    this.disconnect();
    setTimeout(() => this.connect(), 100);
  }

  close(): void {
    this.disconnect();
    this.closed.emit();
  }

  onOverlayClick(e: Event): void {
    this.close();
  }

  startResize(e: MouseEvent): void {
    e.preventDefault();
    this.resizing = true;
    const startX = e.clientX;
    const startWidth = this.panelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!this.resizing) return;
      const delta = startX - ev.clientX;
      this.panelWidth = Math.max(400, Math.min(window.innerWidth * 0.9, startWidth + delta));
    };
    const onMouseUp = () => {
      this.resizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setTimeout(() => this.fitAddon.fit(), 50);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}
