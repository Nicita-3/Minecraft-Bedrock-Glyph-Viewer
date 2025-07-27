# EN

# Minecraft Bedrock Glyph Viewer

A VS Code extension to display Unicode symbols in the `0xEyyy` format as images from font files.

## ✨ Features

* **🎨 Font Code Visualization**: Automatically displays images next to `0xEyyy` codes and Unicode symbols
* **🔍 Hover Tooltips**: Shows enlarged images with additional info on hover
* **🔄 Unicode Conversion**: Converts selected text from codes to Unicode characters
* **📎 Emoji Picker**: Interface for selecting and inserting symbols
* **🖼️ Pixel-perfect Processing**: Maintains sharpness of pixel images

## 🚀 How it works

1. **Scanning**: Automatically detects `0xEyyy` codes and Unicode characters (0xE000-0xEFFF)
2. **Image Lookup**: Finds corresponding PNG files in the project’s `font` folders
3. **Processing**: Splits images into a 16x16 grid, crops the needed cell, and optimizes it
4. **Displaying**: Shows images next to codes, with enlarged versions on hover

## 📝 Usage Example

```json
{
  "text": "Press 0xE001 to open the menu or ",
  "font": "custom_font"
}
```

**Result**: The code `0xE001` and the symbol \`\` will be displayed as images from the file `glyph_E0.png`, cell at row 0, column 1.

## ⌨️ Commands and Keybindings

| Command                         | Keybinding                     | Description                        |
| ------------------------------- | ------------------------------ | ---------------------------------- |
| `Font Code: Convert to Unicode` | `Ctrl+Shift+U` / `Cmd+Shift+U` | Converts code to Unicode character |
| `Font Code: Show Emoji Picker`  | `Ctrl+Shift+E` / `Cmd+Shift+E` | Opens the emoji picker panel       |

## 📁 File Structure

```
your-project/
├── .../font/
│   ├── glyph_E0.png
│   ├── glyph_E1.png
│   └── ...
└── other-files...
```

**Image Requirements:**

* PNG format with transparency
* 16x16 cell grid
* Dimensions multiple of 16 (e.g. 256x256, 512x512)

## ⚙️ Settings

You can configure image sizes in VS Code settings:

* `glyphViewer.maxHeight` — max height of inline images (default: 14px)
* `glyphViewer.hoverMinSize` — min size for hover images (default: 32px)
* `glyphViewer.hoverMaxSize` — max size for hover images (default: 64px)

## ⚠️ Important Notes

* Font files must be located in the `font` folder
* File names: `glyph_Ex.png` (where x is a hex digit)
* Transparent cells are not displayed
* Supports VS Code 1.102.0+

---

*Developed for Minecraft Bedrock Edition addons.*

# UA

# Minecraft Bedrock Glyph Viewer

VS Code розширення для відображення Unicode символів у форматі `0xEyyy` як картинок з шрифтових файлів.

## ✨ Функціональність

- **🎨 Візуалізація шрифтових кодів**: Автоматично відображає картинки після кодів формату `0xEyyy` та Unicode символів
- **🔍 Hover підказки**: При наведенні показує збільшене зображення з додатковою інформацією
- **🔄 Конвертація в Unicode**: Перетворення виділеного тексту з кодів у Unicode символи
- **📎 Emoji Picker**: Інтерфейс для вибору та вставки символів
- **🖼️ Піксель-перфектна обробка**: Збереження чіткості піксельних зображень

## 🚀 Як це працює

1. **Сканування**: Автоматично знаходить коди `0xEyyy` та Unicode символи (0xE000-0xEFFF)
2. **Пошук зображень**: Знаходить відповідні PNG файли в папках `font` проекту
3. **Обробка**: Ділить зображення на сітку 16x16, вирізає потрібну клітинку та оптимізує
4. **Відображення**: Показує картинки поряд з кодами, збільшені версії при hover

## 📝 Приклад використання

```json
{
  "text": "Натисніть 0xE001 щоб відкрити меню або ",
  "font": "custom_font"
}
```

**Результат**: Код `0xE001` та символ `` будуть відображені з картинками з файлу `glyph_E0.png`, клітинка в рядку 0, стовпці 1.

## ⌨️ Команди та комбінації клавіш

| Команда | Комбінація клавіш | Опис |
|---------|-------------------|------|
| `Font Code: Convert to Unicode` | `Ctrl+Shift+U` / `Cmd+Shift+U` | Конвертує код у Unicode символ |
| `Font Code: Show Emoji Picker` | `Ctrl+Shift+E` / `Cmd+Shift+E` | Відкриває панель вибору символів |

## 📁 Структура файлів

```
your-project/
├── .../font/
│   ├── glyph_E0.png
│   ├── glyph_E1.png
│   └── ...
└── other-files...
```

**Вимоги до зображень:**
- Формат PNG з прозорістю
- Сітка 16x16 комірок
- Кратний 16 розмір (256x256, 512x512, тощо)

## ⚙️ Налаштування

Ви можете налаштувати розміри зображень у настройках VS Code:

- `glyphViewer.maxHeight` - максимальна висота inline зображень (за замовчуванням: 14px)
- `glyphViewer.hoverMinSize` - мінімальний розмір для hover (за замовчуванням: 32px)  
- `glyphViewer.hoverMaxSize` - максимальний розмір для hover (за замовчуванням: 64px)

## ⚠️ Важливі примітки

- Файли шрифтів повинні знаходитись в папці `font`
- Назви файлів: `glyph_Ex.png` (де x - hex символ)
- Прозорі клітинки не відображаються
- Підтримує VS Code 1.102.0+

---

*Розроблено для Minecraft Bedrock Edition доповнень.*