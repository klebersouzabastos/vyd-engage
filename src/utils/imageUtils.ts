/**
 * Redimensiona uma imagem para um tamanho adequado para uso na aplicação
 * A imagem será redimensionada mantendo a proporção e otimizada para:
 * - Exibição no sidebar (36x36px)
 * - Exibição em relatórios exportados (80x80px)
 *
 * @param file Arquivo de imagem a ser redimensionado
 * @param maxWidth Largura máxima em pixels (padrão: 200px)
 * @param maxHeight Altura máxima em pixels (padrão: 200px)
 * @param quality Qualidade da compressão JPEG (0-1, padrão: 0.9)
 * @returns Promise<string> Base64 da imagem redimensionada
 */
export async function resizeImage(
  file: File,
  maxWidth: number = 200,
  maxHeight: number = 200,
  quality: number = 0.9
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Para SVGs, retornar o arquivo original convertido para base64
    // pois SVGs são vetoriais e não precisam de redimensionamento
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('Erro ao ler o arquivo SVG'));
        }
      };
      reader.onerror = () => {
        reject(new Error('Erro ao ler o arquivo SVG'));
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        // Calcular novas dimensões mantendo a proporção
        let width = img.width;
        let height = img.height;

        // Redimensionar apenas se a imagem for maior que o máximo
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        // Criar canvas para redimensionar
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível criar o contexto do canvas'));
          return;
        }

        // Melhorar a qualidade do redimensionamento
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Desenhar imagem redimensionada no canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Converter para base64
        // Usar PNG para manter transparência, ou JPEG para melhor compressão
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

        const dataUrl = canvas.toDataURL(mimeType, quality);
        resolve(dataUrl);
      };

      img.onerror = () => {
        reject(new Error('Erro ao carregar a imagem'));
      };

      // Definir src da imagem com os dados do arquivo
      if (event.target?.result) {
        img.src = event.target.result as string;
      } else {
        reject(new Error('Erro ao ler o arquivo'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler o arquivo'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Valida se o arquivo é uma imagem válida
 * @param file Arquivo a ser validado
 * @returns boolean
 */
export function isValidImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Valida o tamanho do arquivo
 * @param file Arquivo a ser validado
 * @param maxSizeMB Tamanho máximo em MB (padrão: 5MB)
 * @returns boolean
 */
export function isValidFileSize(file: File, maxSizeMB: number = 5): boolean {
  return file.size <= maxSizeMB * 1024 * 1024;
}

/**
 * Converte uma imagem base64 para um formato compatível com Excel
 * Remove o prefixo data:image se necessário e garante que seja uma string válida
 * @param base64Image String base64 da imagem
 * @returns string Base64 limpa para uso no Excel
 */
export function prepareImageForExcel(base64Image: string | null): string | null {
  if (!base64Image) return null;

  // Se já é uma data URL, retornar como está (Excel pode aceitar)
  // Mas vamos garantir que não tenha caracteres problemáticos
  try {
    // Remover quebras de linha e espaços extras que podem causar problemas
    const cleaned = base64Image.replace(/\s+/g, '');

    // Verificar se é uma data URL válida
    if (cleaned.startsWith('data:image/')) {
      return cleaned;
    }

    // Se não tem prefixo, adicionar um padrão
    if (cleaned.length > 0) {
      // Assumir PNG se não especificado
      return `data:image/png;base64,${cleaned}`;
    }

    return null;
  } catch (error) {
    console.error('Erro ao preparar imagem para Excel:', error);
    return null;
  }
}
