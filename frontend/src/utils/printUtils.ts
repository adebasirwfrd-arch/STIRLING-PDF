
/**
 * Utilities for printing files
 */

export const printPdf = (file: File) => {
    const url = URL.createObjectURL(file);
    const iframe = document.createElement('iframe');

    // Hide iframe but keep it part of the DOM for printing
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    iframe.src = url;
    document.body.appendChild(iframe);

    iframe.onload = () => {
        // Small delay to ensure render
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        }, 100);
    };

    // Cleanup after print dialog usage (approximate, since we can't strictly detect print close)
    // We use a long timeout to allow the print dialog to open
    setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
    }, 60000); // 1 minute cleanup
};
