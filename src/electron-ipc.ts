import { BrowserWindow, WebContents, ipcRenderer } from "electron";
import { Channels, DuplexChannel } from "./channel";
import { ChannelState, ControlFlags, ELectronProcessTypes, SignalData } from "./types";
import { filter } from "rxjs";

export class ElectronIPC {
    protected static _instance: ElectronIPC;
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
