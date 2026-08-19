"""Detecta el hardware (GPU NVIDIA/CUDA o CPU) y decide la config de Whisper.

Se llama al inicio de CADA corrida -> el mismo repo corre bien en el PC sin GPU (CPU, modelo
liviano) y en el PC con GPU (CUDA, modelo grande y rapido). Se puede forzar con DEVICE=cpu|cuda.
"""
import os
import shutil
import subprocess


def _tiene_gpu_nvidia() -> bool:
    # 1) nvidia-smi en el PATH = hay driver NVIDIA
    if shutil.which("nvidia-smi"):
        try:
            r = subprocess.run(["nvidia-smi"], capture_output=True, timeout=8)
            if r.returncode == 0:
                return True
        except Exception:
            pass
    # 2) torch con CUDA (si esta instalado)
    try:
        import torch  # noqa
        if torch.cuda.is_available():
            return True
    except Exception:
        pass
    return False


def detectar() -> dict:
    """Devuelve la config de dispositivo/modelo segun el hardware disponible."""
    forzado = (os.getenv("DEVICE") or "auto").strip().lower()
    if forzado == "cuda":
        gpu = True
    elif forzado == "cpu":
        gpu = False
    else:
        gpu = _tiene_gpu_nvidia()

    if gpu:
        cfg = {
            "device": "cuda",
            "compute_type": "float16",
            "whisper_model": "large-v3",   # el mejor, rapido con GPU
            "nota": "GPU NVIDIA detectada -> modo rapido (Whisper large-v3, CUDA).",
        }
    else:
        cfg = {
            "device": "cpu",
            "compute_type": "int8",
            "whisper_model": "small",      # liviano para no tardar demasiado en CPU
            "nota": "Sin GPU -> modo CPU (Whisper small, int8). Mas lento pero funciona.",
        }
    cfg["forzado"] = forzado
    return cfg


if __name__ == "__main__":
    import json
    print(json.dumps(detectar(), indent=2, ensure_ascii=False))
