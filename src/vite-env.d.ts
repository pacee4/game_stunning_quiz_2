/// <reference types="vite/client" />
import type { DebugTools } from "@/core/debug_tools";
import type { SpriteStorage } from "@/sprites/storage";

declare global {
    interface Window {
        /** Debug tools only for development */
        debugTools?: DebugTools;
    }
}