import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default {
    input: './electron/preload.ts',
    output: {
        dir: './dist/electron',
        format: 'cjs',
        sourcemap: false,
    },
    plugins: [
        nodeResolve({
            resolveOnly: ['rxjs']
        }),
        typescript()
    ]
}
