package stirling.software.SPDF.service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Collections;
import java.util.List;

import org.springframework.stereotype.Service;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.FileContent;
import com.google.api.client.http.HttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.DriveScopes;
import com.google.api.services.drive.model.File;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;

import jakarta.annotation.PostConstruct;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class GoogleDriveService {

    private static final String APPLICATION_NAME = "Stirling-PDF";
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final List<String> SCOPES = Collections.singletonList(DriveScopes.DRIVE_FILE);
    
    // Default folder ID, can be overridden by GOOGLE_DRIVE_TARGET_FOLDER_ID environment variable
    private static final String DEFAULT_TARGET_FOLDER_ID = "1QAP_f4Uzt2jPeSII5sGD0uu1mIiTdZbQ";

    private Drive driveService;
    private String serviceAccountEmail = "Unknown";

    @PostConstruct
    public void init() {
        log.info("GoogleDriveService initialized. Checking credentials...");
        try {
            getDriveService();
            log.info("Google Drive Service established for account: " + serviceAccountEmail);
            log.info("Target Folder ID set to: " + getTargetFolderId());
        } catch (Exception e) {
            log.warn("Google Drive Service failed to initialize on startup: " + e.getMessage());
        }
    }

    private String getTargetFolderId() {
        String envFolderId = System.getenv("GOOGLE_DRIVE_TARGET_FOLDER_ID");
        return (envFolderId != null && !envFolderId.isEmpty()) ? envFolderId : DEFAULT_TARGET_FOLDER_ID;
    }

    private GoogleCredentials getCredentials() throws IOException {
        String serviceAccountJson = System.getenv("GOOGLE_SERVICE_ACCOUNT_JSON");
        if (serviceAccountJson == null || serviceAccountJson.isEmpty()) {
            throw new IOException("GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set!");
        }
        
        try {
            GoogleCredentials credentials = GoogleCredentials.fromStream(new ByteArrayInputStream(serviceAccountJson.getBytes()))
                    .createScoped(SCOPES);
            
            if (credentials instanceof ServiceAccountCredentials) {
                this.serviceAccountEmail = ((ServiceAccountCredentials) credentials).getClientEmail();
            }
            
            return credentials;
        } catch (Exception e) {
            log.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: " + e.getMessage());
            throw new IOException("Invalid Google Service Account credentials", e);
        }
    }

    private Drive getDriveService() throws Exception {
        if (driveService == null) {
            final HttpTransport HTTP_TRANSPORT = GoogleNetHttpTransport.newTrustedTransport();
            GoogleCredentials credentials = getCredentials();
            driveService = new Drive.Builder(HTTP_TRANSPORT, JSON_FACTORY, new HttpCredentialsAdapter(credentials))
                    .setApplicationName(APPLICATION_NAME)
                    .build();
        }
        return driveService;
    }

    public String uploadFile(Path filePath, String fileName, String mimeType) throws Exception {
        log.info("Attempting to upload file to Google Drive: " + fileName);
        Drive service = getDriveService();

        File fileMetadata = new File();
        fileMetadata.setName(fileName);
        fileMetadata.setParents(Collections.singletonList(getTargetFolderId()));

        java.io.File filePathIo = filePath.toFile();
        FileContent mediaContent = new FileContent(mimeType, filePathIo);
        
        try {
            File file = service.files().create(fileMetadata, mediaContent).setFields("id").execute();
            log.info("File successfully uploaded to Google Drive. ID: " + file.getId() + " (Owner: " + serviceAccountEmail + ")");
            return file.getId();
        } catch (Exception e) {
            log.error("Google Drive upload failed for account " + serviceAccountEmail + ": " + e.getMessage());
            if (e.getMessage().contains("storageQuotaExceeded")) {
                log.error("CRITICAL: Service Account has no storage quota. You MUST share the target folder (" + getTargetFolderId() + ") with the email: " + serviceAccountEmail + " and grant 'Editor' permissions.");
            }
            throw e;
        }
    }
}
