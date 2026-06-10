import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type ListingGalleryProps = {
  images: { url: string; sort_index: number }[];
  alt: string;
  overlay?: React.ReactNode;
};

export function ListingGallery({ images, alt, overlay }: ListingGalleryProps) {
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const touchStartX = React.useRef<number | null>(null);

  const imageCount = images.length;
  const hasImages = imageCount > 0;
  const activeImage = images[selectedIndex];

  console.log("Gallery image count", images.length);
  console.log("Gallery images", images);

  const showPreviousImage = React.useCallback(() => {
    if (!imageCount) return;
    setSelectedIndex((current) => (current - 1 + imageCount) % imageCount);
  }, [imageCount]);

  const showNextImage = React.useCallback(() => {
    if (!imageCount) return;
    setSelectedIndex((current) => (current + 1) % imageCount);
  }, [imageCount]);

  const openViewer = (index: number) => {
    setSelectedIndex(index);
    setViewerOpen(true);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;

    const touchEndX = event.changedTouches[0]?.clientX;
    if (touchEndX === undefined) return;

    const swipeDistance = touchStartX.current - touchEndX;
    touchStartX.current = null;

    if (Math.abs(swipeDistance) < 50) return;

    if (swipeDistance > 0) {
      showNextImage();
    } else {
      showPreviousImage();
    }
  };

  React.useEffect(() => {
    if (!carouselApi) return;

    const syncSelectedIndex = () => {
      setSelectedIndex(carouselApi.selectedScrollSnap());
    };

    syncSelectedIndex();
    carouselApi.on("select", syncSelectedIndex);
    carouselApi.on("reInit", syncSelectedIndex);

    return () => {
      carouselApi.off("select", syncSelectedIndex);
      carouselApi.off("reInit", syncSelectedIndex);
    };
  }, [carouselApi]);

  React.useEffect(() => {
    if (!carouselApi || !imageCount) return;

    carouselApi.scrollTo(selectedIndex);
  }, [carouselApi, imageCount, selectedIndex]);

  React.useEffect(() => {
    if (!viewerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPreviousImage();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNextImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showNextImage, showPreviousImage, viewerOpen]);

  React.useEffect(() => {
    if (!imageCount) {
      setSelectedIndex(0);
      setViewerOpen(false);
      return;
    }

    if (selectedIndex >= imageCount) {
      setSelectedIndex(imageCount - 1);
    }
  }, [imageCount, selectedIndex]);

  return (
    <>
      <Card className="overflow-hidden border-border/60">
        <CardContent className="relative p-0">
          {hasImages ? (
            <Carousel opts={{ loop: imageCount > 1 }} setApi={setCarouselApi}>
              <CarouselContent>
                {images.map((img, index) => (
                  <CarouselItem key={`${img.sort_index}-${img.url}`} className="basis-full">
                    <button
                      type="button"
                      className="block h-80 w-full cursor-zoom-in overflow-hidden"
                      onClick={() => openViewer(index)}
                      aria-label={`Open image ${index + 1} of ${imageCount}`}
                    >
                      <img src={img.url} alt={alt} className="h-full w-full object-cover" />
                    </button>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {imageCount > 1 && (
                <>
                  <CarouselPrevious className="left-3" variant="secondary" />
                  <CarouselNext className="right-3" variant="secondary" />
                </>
              )}
              <div className="absolute bottom-3 left-3 rounded-full bg-background/85 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                {selectedIndex + 1} / {imageCount}
              </div>
            </Carousel>
          ) : (
            <div className="flex h-80 items-center justify-center bg-muted text-sm text-muted-foreground">
              No images
            </div>
          )}
          {overlay}
        </CardContent>
      </Card>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="fixed inset-0 left-0 top-0 h-screen max-h-screen w-screen max-w-none translate-x-0 translate-y-0 border-0 bg-background/95 p-0 shadow-none sm:rounded-none">
          <DialogTitle className="sr-only">{alt} image viewer</DialogTitle>
          <DialogDescription className="sr-only">
            Image {selectedIndex + 1} of {imageCount}
          </DialogDescription>
          <div
            className="relative flex h-full w-full touch-pan-y items-center justify-center overflow-hidden px-4 py-14 sm:px-16"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {imageCount > 1 && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full sm:inline-flex"
                onClick={showPreviousImage}
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}

            {activeImage && (
              <img
                src={activeImage.url}
                alt={alt}
                className="max-h-full max-w-full select-none object-contain"
                draggable={false}
              />
            )}

            {imageCount > 1 && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full sm:inline-flex"
                onClick={showNextImage}
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}

            {hasImages && (
              <div className="absolute bottom-4 left-1/2 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col items-center gap-3">
                {imageCount > 1 && (
                  <div className="flex max-w-full gap-2 overflow-x-auto rounded-full bg-background/75 p-2 shadow-sm backdrop-blur">
                    {images.map((img, index) => (
                      <button
                        type="button"
                        key={`${img.sort_index}-${img.url}-thumb`}
                        className={`h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 transition ${
                          selectedIndex === index
                            ? "border-primary"
                            : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                        onClick={() => setSelectedIndex(index)}
                        aria-label={`Show image ${index + 1} of ${imageCount}`}
                      >
                        <img src={img.url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {imageCount > 1 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="rounded-full sm:hidden"
                      onClick={showPreviousImage}
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  )}
                  <div className="rounded-full bg-background/85 px-3 py-1 text-sm font-medium text-foreground shadow-sm backdrop-blur">
                    {selectedIndex + 1} / {imageCount}
                  </div>
                  {imageCount > 1 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="rounded-full sm:hidden"
                      onClick={showNextImage}
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
