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

By selecting text like `0xEyyy`, you can quickly convert it into a Unicode character using a key combination.
You’ll also see a matching icon appear next to the code. Hovering over the character shows additional information and a zoomed-in version of the icon.

![Ctrl + Shift + E](./images/img_2.png)

You can also open a menu that lists all available fonts located in the `font` folder.

![Ctrl + Shift + E](./images/img_1.png)

Right-click to insert the selected emoji into the file.
Left-click to copy the code or Unicode character.
You can also choose which font file to use and what size the emojis should be displayed.

![Ctrl + Shift + E](./images/img_3.png)

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

Виділивши текст типу `0xEyyy`, за допомогою комбінації клавіш ви можете швидко конвертувати його в Unicode-символ.
Також ви побачите, як поруч із кодом з’являється відповідна іконка. Навівши курсор на символ, ви зможете переглянути більше інформації про нього та побачити збільшену версію іконки.

![Ctrl + Shift + E](./images/img_2.png)

Ви також можете відкрити меню, у якому буде перелік усіх шрифтів, що знаходяться в папці `font`.

![Ctrl + Shift + E](./images/img_1.png)

ПКМ — вставити потрібний емодзі у файл.
ЛКМ — скопіювати код або Unicode-символ.
Також можна обрати, з якого файлу брати емодзі, і в якому розмірі їх відображати.

![Ctrl + Shift + E](./images/img_3.png)

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