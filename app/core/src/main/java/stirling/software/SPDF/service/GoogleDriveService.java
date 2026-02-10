package stirling.software.SPDF.service;

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
import com.google.auth.oauth2.UserCredentials;

import jakarta.annotation.PostConstruct;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class GoogleDriveService {

    private static final String APPLICATION_NAME = "Stirling-PDF";
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final List<String> SCOPES = Collections.singletonList(DriveScopes.DRIVE_FILE);
    
    private static final String DEFAULT_TARGET_FOLDER_ID = "1QAP_f4Uzt2jPeSII5sGD0uu1mIiTdZbQ";

    private Drive driveService;

    @PostConstruct
    public void init() {
        log.info("GoogleDriveService initialized. Ready for OAuth2 Sync.");
    }

    private String getTargetFolderId() {
        String envFolderId = System.getenv("GOOGLE_DRIVE_TARGET_FOLDER_ID");
        return (envFolderId != null && !envFolderId.isEmpty()) ? envFolderId : DEFAULT_TARGET_FOLDER_ID;
    }

    private GoogleCredentials getCredentials() throws IOException {
        String clientId = System.getenv("GOOGLE_DRIVE_CLIENT_ID");
        String clientSecret = System.getenv("GOOGLE_DRIVE_CLIENT_SECRET");
        String refreshToken = System.getenv("GOOGLE_DRIVE_REFRESH_TOKEN");

        if (clientId == null || clientSecret == null || refreshToken == null) {
            log.error("Missing Google Drive OAuth2 credentials! Ensure GOOGLE_DRIVE_CLIENT_ID, CLIENT_SECRET, and REFRESH_TOKEN are set.");
            throw new IOException("Missing OAuth2 credentials");
        }
        
        return UserCredentials.newBuilder()
                .setClientId(clientId)
                .setClientSecret(clientSecret)
                .setRefreshToken(refreshToken)
                .build();
    }

    private Drive getDriveService() throws Exception {
        if (driveService == null) {
            final HttpTransport HTTP_TRANSPORT = GoogleNetHttpTransport.newTrustedTransport();
            GoogleCredentials credentials = getCredentials();
            driveService = new Drive.Builder(HTTP_TRANSPORT, JSON_FACTORY, new HttpCredentialsAdapter(credentials))
                    .setApplicationName(APPLICATION_NAME)
                    .build();
            log.info("Google Drive Service established using User Refresh Token.");
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
            File file = service.files().create(fileMetadata, mediaContent)
                    .setFields("id")
                    .setSupportsAllDrives(true)
                    .execute();
            log.info("File successfully uploaded to Google Drive. ID: " + file.getId());
            return file.getId();
        } catch (Exception e) {
            log.error("Google Drive upload failed: " + e.getMessage());
            // If token expired or other auth issue, clear service to force re-auth next time
            if (e.getMessage().contains("401") || e.getMessage().contains("403")) {
                driveService = null;
            }
            throw e;
        }
    }
}
