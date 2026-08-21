/**
 * Envoltorio de escritorio opcional.
 *
 * La PWA ya se instala en el PC desde el navegador, asi que esto es solo para
 * quien quiera un .exe / .dmg de verdad. Carga los mismos ficheros compilados
 * que sirve la web: no hay una segunda version del codigo que mantener.
 *
 *   cd apps/desktop && npm install && npm start
 *   npm run dist          # genera instalador en apps/desktop/release
 *
 * Si defines HABIT_SERVER (p.ej. http://192.168.1.40:4321) abre esa direccion
 * en lugar de los ficheros locales, para compartir datos con el movil.
 */
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 380,
    backgroundColor: '#0b1f1c',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  const server = process.env.HABIT_SERVER;
  if (server) win.loadURL(server);
  else win.loadFile(path.join(__dirname, '../web/dist/index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
