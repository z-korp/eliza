[@ai16z/eliza v0.1.5-alpha.0](../index.md) / Handler

# Type Alias: Handler()

> **Handler**: (`runtime`, `message`, `state`?, `options`?, `callback`?) => `Promise`\<`unknown`\>

Handler function type for processing messages

## Parameters

• **runtime**: [`IAgentRuntime`](../interfaces/IAgentRuntime.md)

• **message**: [`Memory`](../interfaces/Memory.md)

• **state?**: [`State`](../interfaces/State.md)

• **options?**

• **callback?**: [`HandlerCallback`](HandlerCallback.md)

## Returns

`Promise`\<`unknown`\>

## Defined in

[packages/core/src/types.ts:366](https://github.com/z-korp/eliza/blob/main/packages/core/src/types.ts#L366)
