import { BrowserWindow, ipcMain, ipcRenderer, WebContents } from "electron";
import { filter } from "rxjs/operators";
import { DuplexChannel } from "./channel";
import { ChannelState, ControlFlags, ELectronProcessTypes, SignalData } from "./types"

interface Channels<U> {
    [index: string]: DuplexChannel<U>;
}

class ElectronIPC {
    protected static _instance: ElectronIPCMain | ElectronIPCRenderer;
    protected que: { [index: number]: string[] };
    protected win: BrowserWindow;
    protected isInitialized: boolean = false;
    protected _channels: { [id: number]: { [index: string]: IPCChannel<unknown> } };
    protected constructor(win?: BrowserWindow) {
        if (this.isMain && !win) throw new Error('Browser window is missing');
        this.win = win;
        this.que = {};
        this._channels = {};
    }

    public get channels(): Channels<unknown> {
        return this._channels[this.win?.webContents.id ?? 0];
    }

    public static get instance() {
        return this._instance
    }

    protected addChanel<T>(name: string, data: T, win?: BrowserWindow): DuplexChannel<unknown> {
        if (!win && this.isMain) win = this.win;
        if (!win) throw new Error('window object missing')
        const channel = this.setDataOutgoing({ channel: name, data }, win.webContents);
        if (channel) {
            let id: number = 0;
            if (channel.webContents) id = channel.webContents.id;

            if (!this.isInitialized) {
                if (this.que[id])
                    this.que[id].push(name);
                else this.que[id] = [name];
            }
            let channels = this._channels[id];
            if (channels) Object.assign(channels, { [name]: channel });
            else this._channels[id] = { [name]: channel };
        }
        return channel;
    }

    private get isMain(): boolean {
        return process?.type === ELectronProcessTypes.BROWSER;
    }

    protected resetChannels(id = 0) {
        const channels = this._channels[id];
        if (!channels) return;
        Object.entries(channels).forEach(([key, val]) => {
            if (!this.que[id]?.includes(key)) {
                try {
                    val.close();
                    delete channels[key];
                } catch (error) {
                    console.log(error)
                }
            }
        });
    }

    protected setDataIncoming(sd: SignalData<unknown>, webContents?: WebContents) {
        if (!sd) return;
        let id = 0;
        if (webContents) id = webContents.id;
        else if (this.isMain) {
            if (!this.win) throw new Error('window object missing');
            id = this.win.webContents.id;
        }
        const channels = this._channels[id];
        if (!channels) {
            const channel = new IPCChannel(sd.channel, sd.data, webContents, ChannelState.INCOMING);
            this._channels[id] = { [sd.channel]: channel };
            return channel;
        }
        else {
            const channel = channels[sd.channel];
            if (!channel) {
                channels[sd.channel] = new IPCChannel(sd.channel, sd.data, webContents, ChannelState.INCOMING);
                return channels[sd.channel];
            }
            else channel.recieve(sd.data);
        }
    }

    protected setDataOutgoing(sd: SignalData<unknown>, webContents?: WebContents) {
        if (!sd) return;
        let id = 0;
        if (webContents) id = webContents.id;
        else if (this.isMain) {
            if (!this.win) throw new Error('window object missing');
            id = this.win.webContents.id;
        }
        const channels = this._channels[id];
        if (!channels) return new IPCChannel(sd.channel, sd.data, webContents, ChannelState.OUTGOING);

        else {
            const channel = channels[sd.channel];
            if (!channel) return new IPCChannel(sd.channel, sd.data, webContents, ChannelState.OUTGOING);
            else channel.send(sd.data);
        }
    }

    protected loadQue(id = 0) {
        Object.keys(this._channels[id])?.forEach(val => {
            if (this.que[id]) this.que[id].push(val)
            else this.que[id] = [];
        });
        //console.log(this.que);
    }

}

export class ElectronIPCMain extends ElectronIPC {
    private constructor(win: BrowserWindow) {
        super(win);
        this.initMain();
    }

    public static initialize(win: BrowserWindow): ElectronIPCMain {
        if (!this._instance) this._instance = new ElectronIPCMain(win);
        (this._instance as ElectronIPCMain).deaultWindow = win
        return this._instance as ElectronIPCMain;
    }

    public get<T>(channelName: string, id?: number) {
        return <DuplexChannel<T>>this._channels[id ?? this.win?.webContents.id ?? 0]?.[channelName];
    }

    public getChannelsForWindow(id?: number): Channels<unknown> {
        return this._channels[id ?? this.win?.webContents.id ?? 0];
    }

    public set deaultWindow(win: BrowserWindow) {
        this.win = win;
    }

    public addChanel<T>(name: string, data: T, win?: BrowserWindow): DuplexChannel<unknown> {
        return super.addChanel(name, data, win);
    }

    private initMain() {
        console.log('init main');
        ipcMain.on(ControlFlags.INIT, (event) => {
            const sender = event.sender;
            console.log(`init renderer: ${sender.id}`)
            this.resetChannels(sender.id);
            this.isInitialized = true;
            sender.send(ControlFlags.INIT);
            this.que[sender.id]?.forEach(channelName => {
                sender.send(ControlFlags.CREATE,
                    {
                        channel: channelName,
                        data: this._channels[sender.id][channelName]?.localValue,
                    } as SignalData<unknown>);
            });
            this.que[sender.id] = [];
        });

        ipcMain.on(ControlFlags.CREATE, (event, data: SignalData<unknown>) => {
            this.setDataIncoming(data, event.sender);
        });
        ipcMain.on(ControlFlags.CLOSE, (event, data: SignalData<unknown>) => {
            const channel = this._channels[event.sender.id][data.channel];
            if (channel) {
                channel.close();
                delete this._channels[event.sender.id][data.channel];
            }
        });
        ipcMain.on(ControlFlags.DATA, (event, data: SignalData<unknown>) => {
            //console.log(event.sender.id, data)
            this.setDataIncoming(data, event.sender);
        });
        ipcMain.once(ControlFlags.QUIT, (event) => {
            this.resetChannels(event.sender.id);
            this.isInitialized = false;
            this.loadQue(event.sender.id);
        });

        ipcMain.on(ControlFlags.RELOAD, (event) => {
            this.loadQue(event?.sender.id);
        });

    }

}

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


class IPCChannel<U> extends DuplexChannel<U>{
    readonly name: string;
    readonly webContents: WebContents;
    constructor(name: string, data: U, webContents?: WebContents, state = ChannelState.OUTGOING) {
        super(data, state);
        this.name = name;
        if (this.isMain)
            this.webContents = webContents;
        this.outgoing.pipe(filter(val => val ? true : false)).subscribe(data => {
            (this.isMain ? this.webContents : ipcRenderer).send(ControlFlags.DATA,
                {
                    channel: this.name,
                    data: data,
                } as SignalData<unknown>)
        });
    }

    recieve(data: U) {
        this.incoming.next(data);
    }

    private get isMain(): boolean {
        return process?.type === ELectronProcessTypes.BROWSER;
    }

    get localValue() {
        return this.outgoing?.value;
    }
}
