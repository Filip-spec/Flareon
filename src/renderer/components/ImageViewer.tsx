import { X, Download, ExternalLink } from "lucide-react";
import { theme } from "../styles/theme";

interface ImageViewerProps {
  images: Array<{src: string, alt: string, width: number, height: number}>;
  onClose: () => void;
}

const ImageViewer = ({ images, onClose }: ImageViewerProps) => {
  const handleDownload = async (src: string, index: number) => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image-${index + 1}.${blob.type.split('/')[1] || 'png'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download image', err);
    }
  };

  const handleOpenInNewTab = (src: string) => {
    window.open(src, '_blank');
  };

  const styles = {
    container: {
      position: 'fixed' as const,
      top: 0,
      right: 0,
      bottom: 0,
      width: 400,
      background: 'rgba(10, 10, 10, 0.98)',
      borderLeft: `1px solid ${theme.colors.border}`,
      display: 'flex',
      flexDirection: 'column' as const,
      color: theme.colors.textPrimary,
      zIndex: 1000,
      animation: 'slideInRight 0.3s ease-out'
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: `1px solid ${theme.colors.border}`,
      background: 'rgba(0, 0, 0, 0.3)'
    },
    title: {
      fontSize: 14,
      fontWeight: 600,
      color: theme.colors.textPrimary
    },
    closeBtn: {
      background: 'transparent',
      border: 'none',
      color: theme.colors.textSecondary,
      cursor: 'pointer',
      padding: 4,
      borderRadius: 4,
      display: 'flex',
      alignItems: 'center'
    },
    content: {
      flex: 1,
      overflow: 'auto',
      padding: 16
    },
    imageCard: {
      background: 'rgba(255, 255, 255, 0.03)',
      border: `1px solid ${theme.colors.border}`,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      transition: 'all 0.2s ease'
    },
    imageWrapper: {
      width: '100%',
      aspectRatio: '16/9',
      background: 'rgba(0, 0, 0, 0.3)',
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    image: {
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain' as const
    },
    imageInfo: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginBottom: 8
    },
    imageAlt: {
      fontSize: 12,
      color: theme.colors.textPrimary,
      marginBottom: 8,
      wordBreak: 'break-word' as const
    },
    actions: {
      display: 'flex',
      gap: 8
    },
    actionBtn: {
      background: 'rgba(255, 255, 255, 0.05)',
      border: `1px solid ${theme.colors.border}`,
      color: theme.colors.textSecondary,
      cursor: 'pointer',
      padding: '6px 10px',
      borderRadius: 4,
      fontSize: 11,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      transition: 'all 0.2s ease'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          Page Images ({images.length})
        </div>
        <button style={styles.closeBtn} onClick={onClose} title="Close">
          <X size={16} />
        </button>
      </div>

      <div style={styles.content}>
        {images.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: theme.colors.textSecondary, 
            padding: 40,
            fontSize: 13
          }}>
            No images found on this page
          </div>
        ) : (
          images.map((img, index) => (
            <div 
              key={index} 
              style={styles.imageCard}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 109, 0, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
            >
              <div style={styles.imageWrapper}>
                <img 
                  src={img.src} 
                  alt={img.alt}
                  style={styles.image}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              
              {img.alt && (
                <div style={styles.imageAlt}>
                  {img.alt}
                </div>
              )}
              
              <div style={styles.imageInfo}>
                {img.width} × {img.height}px
              </div>
              
              <div style={styles.actions}>
                <button 
                  style={styles.actionBtn}
                  onClick={() => handleDownload(img.src, index)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 109, 0, 0.1)';
                    e.currentTarget.style.borderColor = theme.colors.accent;
                    e.currentTarget.style.color = theme.colors.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = theme.colors.border;
                    e.currentTarget.style.color = theme.colors.textSecondary;
                  }}
                  title="Download image"
                >
                  <Download size={14} />
                  Download
                </button>
                <button 
                  style={styles.actionBtn}
                  onClick={() => handleOpenInNewTab(img.src)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 109, 0, 0.1)';
                    e.currentTarget.style.borderColor = theme.colors.accent;
                    e.currentTarget.style.color = theme.colors.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = theme.colors.border;
                    e.currentTarget.style.color = theme.colors.textSecondary;
                  }}
                  title="Open in new tab"
                >
                  <ExternalLink size={14} />
                  Open
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ImageViewer;
