"""Reference-led albedo palettes; no scene lighting or display post-processing.

Cool mineral shadows, warm cream highlights and restrained earthy local colours.
The ramps compress painted contrast while retaining the original wear/emblems.
"""
import numpy as np

LUMA = np.array([.2126, .7152, .0722])


def rgb(hex_color):
    return np.array([int(hex_color[i:i+2], 16)/255 for i in (0, 2, 4)])


# shadow / middle / light. These are albedo colours, not lamp colours.
PALETTES = {
    'neutral': ('485354', 'a29e8c', 'dfd2b5'),
    'scorch': ('51434c', 'ac7e6d', 'decbab'),
    'wither': ('444d49', 'a1a081', 'd8cfac'),
    'drown': ('354a59', '789b9f', 'ccd3c1'),
    'blocked': ('363f49', '788482', 'b6bba9'),
    # The board still sits a value step below the card backs and the backdrop,
    # so a card reads as an object resting on the stone instead of another
    # square of paving. Cool slate, wide low-frequency range, low chroma. Lift
    # the whole ramp a little: the hazy temple view needs a readable floor, not
    # a near-black hole under the cards.
    'floor': ('434c4e', '77837f', 'b0b8b2'),
    # The scenery is one material family with the paving: same cool grey-green
    # hue direction, separated by value and a little chroma, not by switching
    # to a warm palette. Dressed stone sits a step lighter than the floor,
    # foundation masonry a step darker, and the lacquered gate keeps the single
    # warm note the scene is allowed.
    'stone': ('3e4849', '76807e', 'b2b9af'),
    'masonry': ('333c3f', '5f6a68', '949d96'),
    'wood': ('42383a', '8a6f5e', 'b79b7d'),
    'soil': ('383f42', '6a7172', '979d9d'),
}


def ramp(tone, kind):
    dark, mid, light = [rgb(value) for value in PALETTES[kind]]
    t = np.clip(tone, 0, 1)[..., None]
    return np.where(t <= .5, dark+(mid-dark)*(t*2), mid+(light-mid)*((t-.5)*2))


def board_colour(values, kind):
    luma = values @ LUMA
    if kind == 'floor':
        tone = .04+.90*np.power(luma, .72)
    else:
        # Retain the previous readable midtones, with gentler local colour contrast.
        tone = .02+.96*np.power(luma, .70)*1.08
    colour = ramp(tone, kind)
    # Preserve a small amount of the source's mineral/paint variation.
    source_chroma = values-luma[..., None]
    return np.clip(colour+source_chroma*.18, 0, 1)


def architecture_colour(values, kind):
    luma = values @ LUMA
    tone = .05+.90*np.power(luma, .76)
    return np.clip(ramp(tone, kind)+(values-luma[..., None])*.16, 0, 1)


def prop_colour(values):
    # Keep the tree and cloth's local hues. Lift dark paint into cool, coloured
    # shadows and warm only the light end; opacity is handled separately.
    luma = values @ LUMA
    tone = .045+.96*np.power(luma, .76)
    colour = tone[..., None]+(values-luma[..., None])*.66
    cool = np.array([-.012, .002, .024])
    warm = np.array([.028, .012, -.018])
    blend = np.clip(luma/.75, 0, 1)[..., None]
    return np.clip(colour+cool*(1-blend)+warm*blend, 0, 1)
