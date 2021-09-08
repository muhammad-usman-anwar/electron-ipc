import { BrowserWindow, ipcMain, ipcRenderer } from "electron";
import { filter } from "rxjs/operators";
import { DuplexChannel } from "./channel";
import { ChannelState, ControlFlags, ELectronProcessTypes, SignalData } from "./types"

interface Channels<U> {
    [index: string]: DuplexChannel<U>;
}

export class ElectronIPC {
    private static _instance: ElectronIPC;
    private que: string[];
    private win: BrowserWindow;
    private isInitialized: boolean = false;
    private _channels: { [index: string]: IPCChannel<unknown> };
    private constructor(win?: BrowserWindow) {
        if (this.isMain && !win) throw new Error('Browser window is missing');
        this.win = win;
        this.que = [];
        this._channels = {};
        if (this.isMain) this.initMain();
        else this.initRenderer();
    }

    public get channels(): Channels<unknown> {
        return this._channels;
    }

    public static initialize(win?: BrowserWindow): ElectronIPC {
        if (!this._instance) this._instance = new ElectronIPC(win)
        return this._instance
    }

    public static get instance() {
        return this._instance
    }

    public get<T>(channelName: string) {
        return <DuplexChannel<T>>this._channels?.[channelName];
    }

    public addChanel<T>(name: string, data: T): DuplexChannel<unknown> {
        const channel = this.setDataOutgoing({ channel: name, data });
        if (!this.isInitialized) this.que.push(name);
        if (channel) {
            Object.assign(this._channels, { [name]: channel });
            channel.listenLocal.subscribe(val => {
                (this.isMain ? this.win?.webContents : ipcRenderer).send(ControlFlags.DATA,
                    {
                        channel: name,
                        data: val,
                    } as SignalData<unknown>);
            });
        }
        return channel;
    }

    private get isMain(): boolean {
        return process?.type === ELectronProcessTypes.BROWSER;
    }

    private resetChannels() {
        Object.entries(this._channels).forEach(([key, val]) => {
            if (!this.que.includes(key)) {
                try {
                    val.close();
                    delete this._channels[key];
                } catch (error) {
                    console.log(error)
                }
            }
        });
    }

    private setDataIncoming(sd: SignalData<unknown>) {
        if (!sd) return;
        const channel = this._channels[sd.channel];
        if (!channel) {
            this._channels[sd.channel] = new IPCChannel(sd.data, ChannelState.INCOMING);
            this._channels[sd.channel].listenLocal.subscribe(val => {
                (this.isMain ? this.win?.webContents : ipcRenderer).send(ControlFlags.DATA,
                    {
                        channel: sd.channel,
                        data: val,
                    } as SignalData<unknown>);
            });
            return this._channels[sd.channel];
        }
        else channel.recieve(sd.data);
    }

    private setDataOutgoing(sd: SignalData<unknown>) {
        if (!sd) return;
        const channel = this._channels[sd.channel];
        if (!channel) {
            const channel = new IPCChannel(sd.data, ChannelState.OUTGOING);
            return channel;
        }
        else channel.send(sd.data);
    }

    private initMain() {
        console.log('init main');
        ipcMain.once(ControlFlags.INIT, (event) => {
            console.log('init renderer')
            this.resetChannels();
            this.isInitialized = true;
            this.win.webContents.send(ControlFlags.INIT);
            this.que?.forEach(channelName => {
                this.win.webContents.send(ControlFlags.CREATE,
                    {
                        channel: channelName,
                        data: this._channels[channelName]?.localValue,
                    } as SignalData<unknown>);
            });
            this.que = [];
        });

        ipcMain.on(ControlFlags.CREATE, (event, data: SignalData<unknown>) => {
            this.setDataIncoming(data);
        });
        ipcMain.on(ControlFlags.CLOSE, (event, data: SignalData<unknown>) => {
            const channel = this._channels[data.channel];
            if (channel) {
                channel.close();
                delete this._channels[data.channel];
            }
        });
        ipcMain.on(ControlFlags.DATA, (event, data: SignalData<unknown>) => {
            this.setDataIncoming(data);
        });
        ipcMain.once(ControlFlags.QUIT, (event) => {
            this.resetChannels();
            this.isInitialized = false;
            this.loadQue();
        });

    }

    private loadQue() {
        Object.keys(this.channels)?.forEach(val => { this.que.push(val) });
    }
    private initRenderer() {
        console.log('init renderer')
        ipcRenderer.once(ControlFlags.INIT, (event) => {
            console.log('init main')
            this.resetChannels();
            this.isInitialized = true;
            this.que?.forEach(subjectName => {
                ipcRenderer.send(ControlFlags.CREATE,
                    {
                        channel: subjectName,
                        data: this._channels[subjectName]?.localValue,
                    } as SignalData<unknown>);
            });
            this.que = [];
        })

        ipcRenderer.on(ControlFlags.CREATE, (event, data: SignalData<unknown>) => {
            this.setDataIncoming(data);
        });
        ipcRenderer.on(ControlFlags.CLOSE, (event, data: SignalData<unknown>) => {
            const channel = this._channels[data.channel];
            if (channel) {
                channel.close();
                delete this._channels[data.channel];
            }
        });
        ipcRenderer.on(ControlFlags.DATA, (event, data: SignalData<unknown>) => {
            this.setDataIncoming(data);
        });
        ipcRenderer.once(ControlFlags.QUIT, (event) => {
            this.resetChannels;
            this.isInitialized = false;
            this.loadQue();
        });

        this.pingMain();
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


class IPCChannel<U> extends DuplexChannel<U>{
    constructor(data: U, state = ChannelState.OUTGOING) {
        super(data, state);
    }

    recieve(data: U) {
        this.incoming.next(data);
    }

    get listenLocal() {
        return this.outgoing.pipe(filter(val => val ? true : false));
    }

    get localValue() {
        return this.outgoing?.value;
    }
}