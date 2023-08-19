import { BrowserWindow, ipcMain } from "electron";
import { ElectronIPC } from "./electron-ipc";
import { Channels, DuplexChannel } from "./channel";
import { ControlFlags, SignalData } from "./types";

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
