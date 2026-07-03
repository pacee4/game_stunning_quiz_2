import { getResourcesToLoad } from '@/editable';
import { displayError } from '@/core/asset_loader';
import { screen } from '@/core/screen';
import { UI } from '@/core/dom';

// ПРОВЕРКА И АСИНХРОННАЯ ИНИЦИАЛИЗАЦИЯ ПРОЕКТА
{
    // Обработка ошибок
    const remarks: string[] = [];

    // WebGL
    {
        const canvas = document.createElement('canvas');
        const noWebGL = !(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        if (noWebGL) {
            remarks.push("Ваша видеокарта не поддерживает WebGL или аппаратное ускорение отключено.");
        }
    }
    // Pointer Events
    if (
        !("PointerEvent" in (<any>window))
    ) {
        remarks.push("Нет поддержки Pointer Events.");
    }
    // Web Audio API
    if (
        !("AudioContext" in (<any>window) || "webkitAudioContext" in (<any>window))
    ) {
        remarks.push("Нет поддержки Web Audio API.");
    }

    if (remarks.length===0) {
        screen.init(getResourcesToLoad())
        .catch((error)=>{
            displayError(String(error));
            console.error(error);
        });
    }
    else {
        const remark = remarks.join("\n");
        displayError(remark + "\nДля корректной работы используйте обновлённый браузер.");
        console.error(remark);
    }
}

// ЗАГРУЗКА ИНФОРМАЦИИ
UI.modal.fetchInfo(import.meta.env.DEV ? "./game_directory.json" : "/games/game_directory.json");