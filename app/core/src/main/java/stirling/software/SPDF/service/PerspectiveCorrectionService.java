package stirling.software.SPDF.service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import javax.imageio.ImageIO;

import org.opencv.core.Mat;
import org.opencv.core.MatOfByte;
import org.opencv.core.MatOfPoint;
import org.opencv.core.MatOfPoint2f;
import org.opencv.core.Point;
import org.opencv.core.Size;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.Imgproc;
import org.opencv.utils.Converters;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

import lombok.extern.slf4j.Slf4j;

import nu.pattern.OpenCV;

@Service
@Slf4j
public class PerspectiveCorrectionService {

    @PostConstruct
    public void init() {
        try {
            OpenCV.loadShared();
            log.info("OpenCV loaded successfully.");
        } catch (Exception e) {
            log.error("Failed to load OpenCV", e);
        }
    }

    public BufferedImage autoCropAndWarp(BufferedImage inputImage) {
        try {
            Mat src = bufferedImageToMat(inputImage);
            Mat gray = new Mat();
            Imgproc.cvtColor(src, gray, Imgproc.COLOR_BGR2GRAY);
            Imgproc.GaussianBlur(gray, gray, new Size(5, 5), 0);

            Mat edged = new Mat();
            Imgproc.Canny(gray, edged, 75, 200);

            List<MatOfPoint> contours = new ArrayList<>();
            Mat hierarchy = new Mat();
            Imgproc.findContours(
                    edged, contours, hierarchy, Imgproc.RETR_LIST, Imgproc.CHAIN_APPROX_SIMPLE);

            MatOfPoint2f screenCnt = null;
            double maxArea = 0;

            for (MatOfPoint c : contours) {
                MatOfPoint2f c2f = new MatOfPoint2f(c.toArray());
                double peri = Imgproc.arcLength(c2f, true);
                MatOfPoint2f approx = new MatOfPoint2f();
                Imgproc.approxPolyDP(c2f, approx, 0.02 * peri, true);

                if (approx.total() == 4) {
                    double area = Imgproc.contourArea(approx);
                    if (area > maxArea) {
                        screenCnt = approx;
                        maxArea = area;
                    }
                }
            }

            if (screenCnt == null) {
                log.warn("No document contour found, returning original image.");
                return inputImage;
            }

            // Apply perspective transform
            Mat warped = fourPointTransform(src, screenCnt);
            return matToBufferedImage(warped);

        } catch (Exception e) {
            log.error("Error during perspective correction", e);
            return inputImage;
        }
    }

    private Mat fourPointTransform(Mat image, MatOfPoint2f pts) {
        Point[] points = pts.toArray();
        Point[] orderedPoints = orderPoints(points);

        Point tl = orderedPoints[0];
        Point tr = orderedPoints[1];
        Point br = orderedPoints[2];
        Point bl = orderedPoints[3];

        double widthA = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
        double widthB = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
        int maxWidth = (int) Math.max(widthA, widthB);

        double heightA = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
        double heightB = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));
        int maxHeight = (int) Math.max(heightA, heightB);

        Mat dst =
                Converters.vector_Point2f_to_Mat(
                        List.of(
                                new Point(0, 0),
                                new Point(maxWidth - 1, 0),
                                new Point(maxWidth - 1, maxHeight - 1),
                                new Point(0, maxHeight - 1)));

        Mat M =
                Imgproc.getPerspectiveTransform(
                        Converters.vector_Point2f_to_Mat(List.of(orderedPoints)), dst);
        Mat warped = new Mat();
        Imgproc.warpPerspective(image, warped, M, new Size(maxWidth, maxHeight));

        return warped;
    }

    private Point[] orderPoints(Point[] pts) {
        Point[] ordered = new Point[4];

        // Sum and difference to find corners
        double[] sums = new double[4];
        double[] diffs = new double[4];
        for (int i = 0; i < 4; i++) {
            sums[i] = pts[i].x + pts[i].y;
            diffs[i] = pts[i].y - pts[i].x;
        }

        int tlIdx = 0, brIdx = 0, trIdx = 0, blIdx = 0;
        double minSum = sums[0], maxSum = sums[0], minDiff = diffs[0], maxDiff = diffs[0];

        for (int i = 1; i < 4; i++) {
            if (sums[i] < minSum) {
                minSum = sums[i];
                tlIdx = i;
            }
            if (sums[i] > maxSum) {
                maxSum = sums[i];
                brIdx = i;
            }
            if (diffs[i] < minDiff) {
                minDiff = diffs[i];
                trIdx = i;
            }
            if (diffs[i] > maxDiff) {
                maxDiff = diffs[i];
                blIdx = i;
            }
        }

        ordered[0] = pts[tlIdx];
        ordered[1] = pts[trIdx];
        ordered[2] = pts[brIdx];
        ordered[3] = pts[blIdx];

        return ordered;
    }

    private Mat bufferedImageToMat(BufferedImage bi) throws IOException {
        java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
        ImageIO.write(bi, "png", baos);
        baos.flush();
        return Imgcodecs.imdecode(new MatOfByte(baos.toByteArray()), Imgcodecs.IMREAD_UNCHANGED);
    }

    private BufferedImage matToBufferedImage(Mat matrix) throws IOException {
        MatOfByte mob = new MatOfByte();
        Imgcodecs.imencode(".png", matrix, mob);
        return ImageIO.read(new ByteArrayInputStream(mob.toArray()));
    }
}
