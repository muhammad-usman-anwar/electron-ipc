import { ipcRenderer } from "electron";
import { DuplexChannel } from "./channel";
import { ElectronIPC } from "./electron-ipc";
import { ControlFlags, SignalData } from "./types";

export interface ExposedIPCRenderer {
    getChannel: (name: string) => DuplexChannel<unknown>,
    addChannel: (name: string, data: any) => DuplexChannel<unknown>,
}

export class ElectronIPCRenderer extends ElectronIPC {
    private constructor() {
        super();
        this.initRenderer();
    }

    public static initialize(): ElectronIPCRenderer {
        if (!this._instance) this._instance = new ElectronIPCRenderer();
        return this._instance as ElectronIPCRenderer;
    }

    public get<T>(channelName: string) {
        return <DuplexChannel<T>>this._channels[0]?.[channelName];
    }

    public addChanel<T>(name: string, data: T): DuplexChannel<unknown> {
        return super.addChanel(name, data);
    }

    /**
     * For exposing functions using Electron's contextBridge api
     */
    public get asExposed() {
        return {
            getChannel: (name: string) => this.get(name),
            addChannel: (name: string, initialData: any) => this.addChanel(name, initialData)
        } as ExposedIPCRenderer;
    }

    private initRenderer() {
        console.log('init renderer')
        ipcRenderer.once(ControlFlags.INIT, (event) => {
            console.log('init main')
            this.resetChannels();
            this.isInitialized = true;
            this.que[0]?.forEach(subjectName => {
                ipcRenderer.send(ControlFlags.CREATE,
                    {
                        channel: subjectName,
                        data: this._channels[0][subjectName]?.localValue,
                    } as SignalData<unknown>);
            });
            this.que[0] = [];
        })

        ipcRenderer.on(ControlFlags.CREATE, (event, data: SignalData<unknown>) => {
            this.setDataIncoming(data);
        });
        ipcRenderer.on(ControlFlags.CLOSE, (event, data: SignalData<unknown>) => {
            const channel = this._channels[0][data.channel];
            if (channel) {
                channel.close();
                delete this._channels[0][data.channel];
            }
        });
        ipcRenderer.on(ControlFlags.DATA, (event, data: SignalData<unknown>) => {
            this.setDataIncoming(data);
        });
        ipcRenderer.once(ControlFlags.QUIT, (event) => {
            this.resetChannels();
            this.isInitialized = false;
            this.loadQue();
        });

        this.pingMain();

        window.onbeforeunload = () => {
            console.log('reloading')
            ipcRenderer.send(ControlFlags.RELOAD);
        }
    }

    private pingMain() {
        ipcRenderer.send(ControlFlags.INIT);
        let i = 0;
        let timer: NodeJS.Timer;
        timer = setInterval(() => {
            if (this.isInitialized) {
                clearInterval(timer);
                return;
            }
            if (i > 3) {
                clearInterval(timer);
                throw new Error('IPC Handshake Failed');
            }

            console.log(`No response from main, reconnecting. Attermpt: ${i + 2}`)
            ipcRenderer.send(ControlFlags.INIT);
            i++;
        }, 3000)
    }
}
