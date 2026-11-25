"""Builds one lesson MP4 from a frame manifest with ffmpeg (fast; PowerPoint export is the slow fallback).

  python make_video.py <manifest.json> <out.mp4>

manifest = {"frames": [{"png": "...", "dur": 4.2, "trans": 0.35}, ...]}
Frame k is fully on screen for `dur` seconds; `trans` is the cross-fade INTO frame k.
Needs: pip install imageio-ffmpeg (ships its own ffmpeg binary).
"""
import json, subprocess, sys
from pathlib import Path


def ffmpeg_exe():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def make_video(frames, out, fps=30):
    n = len(frames)
    durs = [float(f['dur']) for f in frames]
    trans = [0.0] + [min(float(f.get('trans', 0.35)), durs[i - 1] * 0.5, durs[i] * 0.5) for i, f in enumerate(frames) if i > 0]
    starts, t = [], 0.0
    for d in durs: starts.append(t); t += d
    total = t
    cmd = [ffmpeg_exe(), '-y', '-loglevel', 'error']
    for i, f in enumerate(frames):
        length = durs[i] + (trans[i] if i else 0)
        cmd += ['-loop', '1', '-framerate', str(fps), '-t', f'{length:.3f}', '-i', str(f['png'])]
    parts = [f'[{i}:v]scale=1920:1080,setsar=1,fps={fps},format=yuv420p,settb=AVTB[v{i}]' for i in range(n)]
    last = 'v0'
    for k in range(1, n):
        offset = starts[k] - trans[k]
        parts.append(f'[{last}][v{k}]xfade=transition=fade:duration={trans[k]:.3f}:offset={offset:.3f}[x{k}]')
        last = f'x{k}'
    parts.append(f'[{last}]fade=t=in:st=0:d=0.5,fade=t=out:st={max(0, total - 0.7):.3f}:d=0.7[out]')
    cmd += ['-filter_complex', ';'.join(parts), '-map', '[out]', '-c:v', 'libx264', '-preset', 'medium', '-tune', 'stillimage',
            '-crf', '20', '-pix_fmt', 'yuv420p', '-r', str(fps), '-movflags', '+faststart', str(out)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode or not Path(out).exists():
        raise RuntimeError('ffmpeg failed: ' + (r.stderr or '')[-800:])
    return total


if __name__ == '__main__':
    m = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    secs = make_video(m['frames'], sys.argv[2])
    print(f'{sys.argv[2]}: {secs:.1f} s, {Path(sys.argv[2]).stat().st_size / 1e6:.1f} MB')
