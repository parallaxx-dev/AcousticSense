"""Count the parameters of the four models and write presentation/data/params.json (read by build.js and report/make_figures.py).
Run from the project root: .venv/bin/python presentation/make_params.py
The layer definitions mirror the Kaggle notebooks (dense, CAE with min-max output, supervised CNN); AST uses the default
ASTConfig, which is the backbone of MIT/ast-finetuned-audioset-10-10-0.4593 (random weights, no download needed)."""
import json, os
os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")
import numpy as np
import tensorflow as tf
L = tf.keras.layers

def count(m):
    t = int(sum(np.prod(w.shape) for w in m.trainable_weights)); n = int(sum(np.prod(w.shape) for w in m.non_trainable_weights))
    return t + n, t

# dense autoencoder: 640 -> 1024-512-256-128 -> 16 -> mirror -> 640
i = tf.keras.Input((640,)); x = i
for s in [1024, 512, 256, 128]: x = L.ReLU()(L.BatchNormalization()(L.Dense(s)(x)))
x = L.ReLU()(L.BatchNormalization()(L.Dense(16)(x)))
for s in [128, 256, 512, 1024]: x = L.ReLU()(L.BatchNormalization()(L.Dense(s)(x)))
dense = tf.keras.Model(i, L.Dense(640)(x))

# convolutional autoencoder (spec): 4 strided conv blocks, 32-unit bottleneck, 4 transposed blocks, sigmoid
i = tf.keras.Input((128, 64, 1)); x = i
for f in (32, 64, 128, 256): x = L.LeakyReLU(negative_slope=0.2)(L.BatchNormalization()(L.Conv2D(f, 3, strides=2, padding="same")(x)))
h, w = x.shape[1], x.shape[2]
x = L.LeakyReLU(negative_slope=0.2)(L.Dense(h * w * 256)(L.Dense(32)(L.Flatten()(x)))); x = L.Reshape((h, w, 256))(x)
for f in (128, 64, 32, 16): x = L.LeakyReLU(negative_slope=0.2)(L.BatchNormalization()(L.Conv2DTranspose(f, 3, strides=2, padding="same")(x)))
cae = tf.keras.Model(i, L.Conv2D(1, 3, padding="same", activation="sigmoid")(x))

# supervised CNN: 3 x (conv + BN + ReLU + max-pool), global average pooling, dropout, sigmoid
i = tf.keras.Input((128, 64, 1)); x = i
for f in (16, 32, 64): x = L.MaxPool2D(2)(L.ReLU()(L.BatchNormalization()(L.Conv2D(f, 3, padding="same")(x))))
sup = tf.keras.Model(i, L.Dense(1, activation="sigmoid")(L.Dropout(0.3)(L.GlobalAveragePooling2D()(x))))

from transformers import ASTConfig, ASTModel
ast = [int(sum(p.numel() for p in ASTModel(ASTConfig()).parameters())), 0]   # frozen: nothing is trained

out = {"dense": count(dense), "cae": count(cae), "sup": count(sup), "ast": ast}
os.makedirs("presentation/data", exist_ok=True)
json.dump(out, open("presentation/data/params.json", "w")); print(out)
