import { NextRequest } from 'next/server';
import { getScan, updateScanStatus, completeScan } from '@/lib/database';
import { scanUrl } from '@/lib/scanner';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scan = getScan(id);

  if (!scan) {
    return new Response('Scan not found', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object | string) => {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
      };

      try {
        updateScanStatus(id, 'scanning');

        for await (const progress of scanUrl(scan.url)) {
          if (progress.type === 'log') {
            send('log', { tag: progress.tag, message: progress.message });
          } else if (progress.type === 'complete' && progress.data) {
            const result = progress.data as {
              score: number;
              semanticScore: number;
              tokenScore: number;
              metadataScore: number;
              rawFindings: Parameters<typeof completeScan>[5];
              recommendations: Parameters<typeof completeScan>[6];
            };

            completeScan(
              id,
              result.score,
              result.semanticScore,
              result.tokenScore,
              result.metadataScore,
              result.rawFindings,
              result.recommendations
            );

            send('complete', {
              score: result.score,
              semanticScore: result.semanticScore,
              tokenScore: result.tokenScore,
              metadataScore: result.metadataScore,
              rawFindings: result.rawFindings,
              recommendations: result.recommendations,
            });
          } else if (progress.type === 'error') {
            updateScanStatus(id, 'error');
            send('error', { message: progress.message });
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        updateScanStatus(id, 'error');
        send('error', { message: errMsg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
