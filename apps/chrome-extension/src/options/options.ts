import { ExtensionPermissionManager } from '../permissions/permission-manager.js';
import { SENSITIVE_DOMAINS_DEFAULT, EXTENSION_STORAGE_KEYS } from '@browser-mcp/shared';

document.addEventListener('DOMContentLoaded', async () => {
  const bridgePortInput = document.getElementById('bridge-port') as HTMLInputElement;
  const authTokenInput = document.getElementById('auth-token') as HTMLInputElement;
  const domainAllowlistTextarea = document.getElementById('domain-allowlist') as HTMLTextAreaElement;
  const domainBlocklistTextarea = document.getElementById('domain-blocklist') as HTMLTextAreaElement;
  const btnSave = document.getElementById('btn-save');
  const btnReset = document.getElementById('btn-reset');
  const saveStatus = document.getElementById('save-status');

  // Load existing values
  const port = await ExtensionPermissionManager.getBridgePort();
  const token = await ExtensionPermissionManager.getAuthToken();
  const config = await ExtensionPermissionManager.getConfig();

  if (bridgePortInput) bridgePortInput.value = port.toString();
  if (authTokenInput) authTokenInput.value = token;
  if (domainAllowlistTextarea) domainAllowlistTextarea.value = config.allowlist.join('\n');
  if (domainBlocklistTextarea) domainBlocklistTextarea.value = config.blocklist.join('\n');

  // Save changes
  btnSave?.addEventListener('click', async () => {
    const newPort = parseInt(bridgePortInput.value, 10) || 19999;
    const newToken = authTokenInput.value.trim();
    const allowlist = domainAllowlistTextarea.value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    const blocklist = domainBlocklistTextarea.value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    await ExtensionPermissionManager.setBridgePort(newPort);
    await ExtensionPermissionManager.setAuthToken(newToken);
    await chrome.storage.local.set({
      [EXTENSION_STORAGE_KEYS.DOMAIN_ALLOWLIST]: allowlist,
      [EXTENSION_STORAGE_KEYS.DOMAIN_BLOCKLIST]: blocklist
    });

    if (saveStatus) {
      saveStatus.textContent = 'Settings saved successfully!';
      setTimeout(() => {
        saveStatus.textContent = '';
      }, 3000);
    }
  });

  // Reset to defaults
  btnReset?.addEventListener('click', async () => {
    if (confirm('Reset settings to default?')) {
      bridgePortInput.value = '19999';
      domainBlocklistTextarea.value = SENSITIVE_DOMAINS_DEFAULT.join('\n');
      domainAllowlistTextarea.value = '';
      btnSave?.click();
    }
  });
});
