/**
 * Google Drive Picker Service
 * Handles Google Drive file picker integration
 */

import { loadScript } from '@app/utils/scriptLoader';

const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';
const ACCESS_TOKEN_KEY = 'googleDrivePickerAccessToken';
const TOKEN_EXPIRY_KEY = 'googleDrivePickerTokenExpiry';
const EXPIRY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minute buffer

interface GoogleDriveConfig {
  clientId: string;
  apiKey: string;
  appId: string;
}

interface PickerOptions {
  multiple?: boolean;
  mimeTypes?: string | null;
}

// Expandable mime types for Google Picker
const expandableMimeTypes: Record<string, string[]> = {
  'image/*': ['image/jpeg', 'image/png', 'image/svg+xml'],
};

/**
 * Convert file input accept attribute to Google Picker mime types
 */
function fileInputToGooglePickerMimeTypes(accept?: string): string | null {
  if (!accept || accept === '' || accept.includes('*/*')) {
    // Setting null will accept all supported mimetypes
    return null;
  }

  const mimeTypes: string[] = [];
  accept.split(',').forEach((part) => {
    const trimmedPart = part.trim();
    if (!(trimmedPart in expandableMimeTypes)) {
      mimeTypes.push(trimmedPart);
      return;
    }

    expandableMimeTypes[trimmedPart].forEach((mimeType) => {
      mimeTypes.push(mimeType);
    });
  });

  return mimeTypes.join(',').replace(/\s+/g, '');
}

class GoogleDrivePickerService {
  private config: GoogleDriveConfig | null = null;
  private tokenClient: any = null;
  private accessToken: string | null = null;
  private gapiLoaded = false;
  private gisLoaded = false;

  constructor() {
    this.accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  /**
   * Check if the current token is valid (including a buffer)
   */
  private isTokenValid(): boolean {
    if (!this.accessToken) return false;

    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiry) return false;

    const expiryTime = parseInt(expiry, 10);
    return Date.now() + EXPIRY_THRESHOLD_MS < expiryTime;
  }

  /**
   * Initialize the service with credentials
   */
  async initialize(config: GoogleDriveConfig): Promise<void> {
    this.config = config;

    // Load Google APIs
    await Promise.all([
      this.loadGapi(),
      this.loadGis(),
    ]);
  }

  /**
   * Load Google API client
   */
  private async loadGapi(): Promise<void> {
    if (this.gapiLoaded) return;

    await loadScript({
      src: 'https://apis.google.com/js/api.js',
      id: 'gapi-script',
    });

    return new Promise((resolve) => {
      window.gapi.load('client:picker', async () => {
        try {
          await window.gapi.client.load('drive', 'v3');
          this.gapiLoaded = true;
          resolve();
        } catch (error) {
          console.error('Failed to load GAPI Drive client:', error);
          resolve(); // Resolve anyway to not block initialization
        }
      });
    });
  }

  /**
   * Load Google Identity Services
   */
  private async loadGis(): Promise<void> {
    if (this.gisLoaded) return;

    await loadScript({
      src: 'https://accounts.google.com/gsi/client',
      id: 'gis-script',
    });

    if (!this.config) {
      throw new Error('Google Drive config not initialized');
    }

    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: this.config.clientId,
      scope: SCOPES,
      callback: () => { }, // Will be overridden during picker creation
    });

    this.gisLoaded = true;
  }

  /**
   * Open the Google Drive picker
   */
  async openPicker(options: PickerOptions = {}): Promise<File[]> {
    if (!this.config) {
      throw new Error('Google Drive service not initialized');
    }

    // Refresh token if missing or expired
    if (!this.isTokenValid()) {
      await this.requestAccessToken();
    }

    // Create and show picker
    return this.createPicker(options);
  }

  /**
   * Request access token from Google
   */
  /**
   * Request access token from Google
   */
  public requestAccessToken(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient) {
        reject(new Error('Token client not initialized'));
        return;
      }

      this.tokenClient.callback = (response: any) => {
        if (response.error !== undefined) {
          reject(new Error(response.error));
          return;
        }
        if (response.access_token == null) {
          reject(new Error("No access token in response"));
        }

        this.accessToken = response.access_token;
        const expiresAt = Date.now() + (response.expires_in * 1000);

        localStorage.setItem(ACCESS_TOKEN_KEY, this.accessToken ?? "");
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString());

        resolve();
      };

      // prompt: '' allows silent refresh if possible
      this.tokenClient.requestAccessToken({
        prompt: '',
      });
    });
  }

  /**
   * Create and display the Google Picker
   */
  private createPicker(options: PickerOptions): Promise<File[]> {
    return new Promise((resolve, reject) => {
      if (!this.config || !this.accessToken) {
        reject(new Error('Not initialized or no access token'));
        return;
      }

      const mimeTypes = fileInputToGooglePickerMimeTypes(options.mimeTypes || undefined);

      const view1 = new window.google.picker.DocsView().setIncludeFolders(true);
      if (mimeTypes !== null) {
        view1.setMimeTypes(mimeTypes);
      }

      const view2 = new window.google.picker.DocsView()
        .setIncludeFolders(true)
        .setEnableDrives(true);
      if (mimeTypes !== null) {
        view2.setMimeTypes(mimeTypes);
      }

      const builder = new window.google.picker.PickerBuilder()
        .setDeveloperKey(this.config.apiKey)
        .setAppId(this.config.appId)
        .setOAuthToken(this.accessToken)
        .addView(view1)
        .addView(view2)
        .setCallback((data: any) => this.pickerCallback(data, resolve, reject));

      if (options.multiple) {
        builder.enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED);
      }

      const picker = builder.build();
      picker.setVisible(true);
    });
  }

  /**
   * Handle picker selection callback
   */
  private async pickerCallback(
    data: any,
    resolve: (files: File[]) => void,
    reject: (error: Error) => void
  ): Promise<void> {
    if (data.action === window.google.picker.Action.PICKED) {
      try {
        const files = await Promise.all(
          data[window.google.picker.Response.DOCUMENTS].map(async (pickedFile: any) => {
            const fileId = pickedFile[window.google.picker.Document.ID];
            const res = await window.gapi.client.drive.files.get({
              fileId: fileId,
              alt: 'media',
            });

            // Convert response body to File object
            const file = new File(
              [new Uint8Array(res.body.length).map((_: any, i: number) => res.body.charCodeAt(i))],
              pickedFile.name,
              {
                type: pickedFile.mimeType,
                lastModified: pickedFile.lastModified,
              }
            );
            return file;
          })
        );

        resolve(files);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to download files'));
      }
    } else if (data.action === window.google.picker.Action.CANCEL) {
      resolve([]); // User cancelled, return empty array
    }
  }

  /**
   * Ensure a folder exists in Google Drive (root level)
   */
  async ensureFolder(folderName: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error('No access token');
    }

    // Check if folder exists
    const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    const response: any = await window.gapi.client.drive.files.list({
      q: q,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (response.result.files && response.result.files.length > 0) {
      return response.result.files[0].id;
    }

    // Create folder
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    const createResponse: any = await window.gapi.client.drive.files.create({
      resource: fileMetadata,
      fields: 'id',
    });

    return createResponse.result.id;
  }

  /**
   * List files in a specific folder to check for duplicates
   */
  async listFilesInFolder(folderId: string): Promise<Set<string>> {
    if (!this.accessToken) {
      throw new Error('No access token');
    }

    let pageToken = null;
    const existingFiles = new Set<string>();

    do {
      const response: any = await window.gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name)',
        spaces: 'drive',
        pageToken: pageToken,
      });

      if (response.result.files) {
        response.result.files.forEach((file: any) => {
          if (file.name) existingFiles.add(file.name);
        });
      }
      pageToken = response.result.nextPageToken;
    } while (pageToken);

    return existingFiles;
  }

  /**
   * Upload a file to Google Drive folder using multipart/related
   */
  async uploadFile(file: File, folderId: string): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token');
    }

    const metadata = {
      name: file.name,
      parents: [folderId],
      mimeType: file.type || 'application/octet-stream',
    };

    const formData = new FormData();
    // Metadata part needed to be distinct, simple fetch with multipart/related or multipart/form-data
    // Google Drive API expects 'multipart/related' but 'multipart/form-data' often works if boundary is handled.
    // However, the cleanest way with fetch is constructing the body manually or using form-data if the API accepts it.
    // The standard way for Drive API v3 is multipart/related.

    // Easier approach: Simple upload if small, but we need metadata (parent folder).
    // Let's use the explicit multipart/related construction.

    const boundary = 'foo_bar_baz';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const metadataStr = JSON.stringify(metadata);
    const contentType = file.type || 'application/octet-stream';

    // We need to read the file as text/base64 or just use blob if we can constructs the body as a Blob.
    // Constructing a composite Blob is best.

    const multipartRequestBody = new Blob(
      [
        delimiter,
        'Content-Type: application/json\r\n\r\n',
        metadataStr,
        delimiter,
        `Content-Type: ${contentType}\r\n`,
        'Content-Transfer-Encoding: base64\r\n\r\n',
      ],
      { type: 'application/json' }
    );

    // Wait, mixing Blob parts is tricky if we want to stream the file. 
    // But we have the File object. Converting to base64 is safer for the text body construction.
    const reader = new FileReader();
    const base64Data = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        // remove data url prefix
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });

    const body =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      metadataStr +
      delimiter +
      `Content-Type: ${contentType}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      base64Data +
      closeDelim;

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
  }

  /**
   * Sign out and revoke access token
   */
  signOut(): void {
    if (this.accessToken) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
      window.google?.accounts.oauth2.revoke(this.accessToken, () => { });
      this.accessToken = null;
    }
  }
}

// Singleton instance
let serviceInstance: GoogleDrivePickerService | null = null;

/**
 * Get or create the Google Drive picker service instance
 */
export function getGoogleDrivePickerService(): GoogleDrivePickerService {
  if (!serviceInstance) {
    serviceInstance = new GoogleDrivePickerService();
  }
  return serviceInstance;
}

/**
 * Check if Google Drive credentials are configured
 */
export function isGoogleDriveConfigured(): boolean {
  const clientId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
  const apiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;
  const appId = import.meta.env.VITE_GOOGLE_DRIVE_APP_ID;

  return !!(clientId && apiKey && appId);
}

/**
 * Get Google Drive configuration from environment variables
 */
export function getGoogleDriveConfig(): GoogleDriveConfig | null {
  if (!isGoogleDriveConfigured()) {
    return null;
  }

  return {
    clientId: import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID,
    apiKey: import.meta.env.VITE_GOOGLE_DRIVE_API_KEY,
    appId: import.meta.env.VITE_GOOGLE_DRIVE_APP_ID,
  };
}
