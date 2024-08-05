import { App, Editor, Notice, Plugin, PluginSettingTab, Setting, moment, MarkdownPreviewRenderer } from 'obsidian';

interface ImageUploaderSettings {
    apiUrl: string;
    apiToken: string;
    appendSuffix: boolean;
    suffixFormat: string;
    accessToken: string;
    customImageDomain: string;
}

const DEFAULT_SETTINGS: ImageUploaderSettings = {
    apiUrl: 'https://api.example.com/upload',
    apiToken: '',
    appendSuffix: false,
    suffixFormat: '-YYYYMMDDHHmmss',
    accessToken: '',
    customImageDomain: 'https://example.com/read',
}

export default class ImageUploaderPlugin extends Plugin {
    settings: ImageUploaderSettings;

    async onload() {
        await this.loadSettings();

        this.addSettingTab(new ImageUploaderSettingTab(this.app, this));

        this.registerEvent(
            this.app.workspace.on('editor-paste', (evt: ClipboardEvent, editor: Editor) => {
                this.handlePaste(evt, editor);
            })
        );

        this.registerEvent(
            this.app.workspace.on('editor-drop', (evt: DragEvent, editor: Editor) => {
                this.handleDrop(evt, editor);
            })
        );

        // TODO not working on editing mode
        MarkdownPreviewRenderer.registerPostProcessor(this.processImages.bind(this));
    }

    processImages(el: HTMLElement) {
        const imgs = el.querySelectorAll('img');
        imgs.forEach((img) => {
            if (this.shouldProcessImage(img.src)) {
                const originalSrc = img.getAttribute('src') || '';
                img.src = this.addTokenToUrl(originalSrc);
            }
        });
    }

    shouldProcessImage(src: string): boolean {
        return this.settings.customImageDomain !== null &&
            this.settings.customImageDomain.trim() !== '' &&
            src.startsWith(this.settings.customImageDomain);
    }

    addTokenToUrl(src: string): string {
        const url = new URL(src);
        url.searchParams.append('token', this.settings.accessToken);
        return url.toString();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async handlePaste(evt: ClipboardEvent, editor: Editor) {
        const files = evt.clipboardData?.files;
        if (files && files.length > 0) {
            evt.preventDefault();
            for (let i = 0; i < files.length; i++) {
                if (files[i].type.startsWith('image')) {
                    await this.uploadAndInsertImage(files[i], editor);
                }
            }
        }
    }

    async handleDrop(evt: DragEvent, editor: Editor) {
        const files = evt.dataTransfer?.files;
        if (files && files.length > 0) {
            evt.preventDefault();
            for (let i = 0; i < files.length; i++) {
                if (files[i].type.startsWith('image')) {
                    await this.uploadAndInsertImage(files[i], editor);
                }
            }
        }
    }

    async uploadAndInsertImage(file: File, editor: Editor) {
        try {
            const formData = new FormData();
            let fileName = file.name;

            if (this.settings.appendSuffix) {
                const suffix = moment().format(this.settings.suffixFormat);
                const nameParts = fileName.split('.');
                if (nameParts.length > 1) {
                    const extension = nameParts.pop();
                    fileName = `${nameParts.join('.')}${suffix}.${extension}`;
                } else {
                    fileName = `${fileName}${suffix}`;
                }
            }

            formData.append('file', file, fileName);

            const response = await fetch(this.settings.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiToken}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            const imageUrl = data.url; // 假设API返回的JSON中包含图片URL

            editor.replaceSelection(`![${fileName}](${imageUrl})`);
        } catch (error) {
            console.error('Error uploading image:', error);
            new Notice('Failed to upload image');
        }
    }
}

class ImageUploaderSettingTab extends PluginSettingTab {
    plugin: ImageUploaderPlugin;

    constructor(app: App, plugin: ImageUploaderPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();
        containerEl.createEl('h2', { text: 'Image Uploader Settings' });

        new Setting(containerEl)
            .setName('API URL')
            .setDesc('Enter the URL of your image upload API')
            .addText(text => text
                .setPlaceholder('Enter API URL')
                .setValue(this.plugin.settings.apiUrl)
                .onChange(async (value) => {
                    this.plugin.settings.apiUrl = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('API Token')
            .setDesc('Enter your API authentication token')
            .addText(text => text
                .setPlaceholder('Enter API token')
                .setValue(this.plugin.settings.apiToken)
                .onChange(async (value) => {
                    this.plugin.settings.apiToken = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Append Suffix to Filename')
            .setDesc('Enable to append a custom suffix to the uploaded image filename')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.appendSuffix)
                .onChange(async (value) => {
                    this.plugin.settings.appendSuffix = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Suffix Format')
            .setDesc('Enter the format for the filename suffix (e.g., YYYYMMDDHHmmss)')
            .addText(text => text
                .setPlaceholder('Enter suffix format')
                .setValue(this.plugin.settings.suffixFormat)
                .onChange(async (value) => {
                    this.plugin.settings.suffixFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('AccessToken')
            .setDesc('Enter your access token')
            .addText(text => text
                .setPlaceholder('Enter your access token')
                .setValue(this.plugin.settings.accessToken)
                .onChange(async (value) => {
                    this.plugin.settings.accessToken = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Custom Image Domain')
            .setDesc('Enter the domain for your custom images (e.g., https://example.com/read)')
            .addText(text => text
                .setPlaceholder('https://example.com/read')
                .setValue(this.plugin.settings.customImageDomain)
                .onChange(async (value) => {
                    this.plugin.settings.customImageDomain = value;
                    await this.plugin.saveSettings();
                }));
    }
}