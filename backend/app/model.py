"""2D convolutional autoencoder (Keras functional API) - per CLAUDE.md spec."""
from __future__ import annotations

from tensorflow.keras import layers, Model


def se_block(x, ratio: int = 8):
    ch = x.shape[-1]
    s = layers.GlobalAveragePooling2D()(x)
    s = layers.Dense(max(ch // ratio, 4), activation="relu")(s)
    s = layers.Dense(ch, activation="sigmoid")(s)
    s = layers.Reshape((1, 1, ch))(s)
    return layers.Multiply()([x, s])


def build_conv_autoencoder(input_shape, latent_dim: int = 32, use_se: bool = False) -> Model:
    inp = layers.Input(shape=input_shape, name="spectrogram")
    x = inp
    for f in (32, 64, 128, 256):                                  # encoder
        x = layers.Conv2D(f, 3, strides=2, padding="same")(x)
        x = layers.BatchNormalization()(x)
        x = layers.LeakyReLU(negative_slope=0.2)(x)
        if use_se:
            x = se_block(x)

    h, w, c = x.shape[1], x.shape[2], x.shape[3]                   # bottleneck
    x = layers.Flatten()(x)
    z = layers.Dense(latent_dim, name="bottleneck")(x)

    x = layers.Dense(h * w * c)(z)                                 # decoder
    x = layers.LeakyReLU(negative_slope=0.2)(x)
    x = layers.Reshape((h, w, c))(x)
    for f in (128, 64, 32, 16):
        x = layers.Conv2DTranspose(f, 3, strides=2, padding="same")(x)
        x = layers.BatchNormalization()(x)
        x = layers.LeakyReLU(negative_slope=0.2)(x)
    out = layers.Conv2D(1, 3, padding="same", activation="sigmoid", name="reconstruction")(x)
    return Model(inp, out, name="conv_autoencoder" + ("_se" if use_se else ""))
