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

import jakarta.annotation.PostConstruct;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class GoogleDriveService {

    private static final String APPLICATION_NAME = "Stirling-PDF";
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final List<String> SCOPES = Collections.singletonList(DriveScopes.DRIVE_FILE);
    private static final String TARGET_FOLDER_ID = "1QAP_f4Uzt2jPeSII5sGD0uu1mIiTdZbQ";

    private Drive driveService;

    @PostConstruct
    public void init() {
        log.info("GoogleDriveService initialized using Service Account.");
    }

    private GoogleCredentials getCredentials() throws IOException {
        String serviceAccountJson = System.getenv("GOOGLE_SERVICE_ACCOUNT_JSON");
        if (serviceAccountJson == null || serviceAccountJson.isEmpty()) {
            log.error("GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set!");
            throw new IOException("Google Service Account credentials missing");
        }
        
        try {
            return GoogleCredentials.fromStream(new ByteArrayInputStream(serviceAccountJson.getBytes()))
                    .createScoped(SCOPES);
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
            log.info("Google Drive Service established using Service Account.");
        }
        return driveService;
    }

    public String uploadFile(Path filePath, String fileName, String mimeType) throws Exception {
        log.info("Attempting to upload file to Google Drive: " + fileName);
        Drive service = getDriveService();

        File fileMetadata = new File();
        fileMetadata.setName(fileName);
        fileMetadata.setParents(Collections.singletonList(TARGET_FOLDER_ID));

        java.io.File filePathIo = filePath.toFile();
        FileContent mediaContent = new FileContent(mimeType, filePathIo);
        
        try {
            File file = service.files().create(fileMetadata, mediaContent).setFields("id").execute();
            log.info("File successfully uploaded to Google Drive. ID: " + file.getId());
            return file.getId();
        } catch (Exception e) {
            log.error("Google Drive upload failed: " + e.getMessage());
            throw e;
        }
    }
}
