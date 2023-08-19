export enum SubjectTypes {
    SUBJECT,
    BEHAVIOR_SUBJECT,
    REPLAY_SUBJECT,
    ASYNC_SUBJECT
}

export enum ControlFlags {
    INIT = 'init',
    QUIT = 'quit',
    CLOSE = 'close',
    CREATE = 'create',
    FAIL = 'fail',
    DATA = 'data',
    RELOAD = 'reload',
}

export enum ELectronProcessTypes {
    BROWSER = 'browser',
    RENDERER = 'renderer',
}

export interface SignalData<T> {
    channel: string;
    data?: T;
}

export enum ChannelState {
    INCOMING,
    OUTGOING
}
