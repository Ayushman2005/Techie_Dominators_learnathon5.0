<script lang="ts">	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { grievanceService } from '$lib/services';
	import type { Grievance, ResolutionReview } from '$lib/types';
	import { toast } from 'svelte-sonner';
	import StarIcon from '@lucide/svelte/icons/star';
	import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';
	import UploadCloudIcon from '@lucide/svelte/icons/upload-cloud';
	import ImageIcon from '@lucide/svelte/icons/image';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import XIcon from '@lucide/svelte/icons/x';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

	let {
		grievance,
		isOwner = false,
		onReviewSubmitted
	}: {
		grievance: Grievance;
		isOwner?: boolean;
		onReviewSubmitted?: (updated: Grievance) => void;
	} = $props();

	let rating = $state(5);
	let hoverRating = $state(0);
	let feedback = $state('');
	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let submitting = $state(false);

	const ratingLabels: Record<number, string> = {
		1: '1/5 - Unsatisfactory',
		2: '2/5 - Needs Improvement',
		3: '3/5 - Satisfactory',
		4: '4/5 - Very Good',
		5: '5/5 - Excellent Resolution'
	};

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString('en-IN', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];
			if (!file.type.startsWith('image/')) {
				toast.error('Please upload an image file (PNG, JPG, WebP).');
				return;
			}
			if (file.size > 5 * 1024 * 1024) {
				toast.error('Image must be smaller than 5MB.');
				return;
			}
			selectedFile = file;
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			previewUrl = URL.createObjectURL(file);
		}
	}

	function removeFile() {
		selectedFile = null;
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
			previewUrl = null;
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!selectedFile) {
			toast.error('Please attach a picture of the resolved solution.');
			return;
		}
		if (feedback.trim().length < 5) {
			toast.error('Please provide at least 5 characters of review feedback.');
			return;
		}

		submitting = true;
		const result = await grievanceService.submitReview(grievance.id, {
			rating,
			feedback: feedback.trim(),
			file: selectedFile
		});
		submitting = false;

		if (result.ok) {
			toast.success('Resolution review and solution photo submitted successfully!');
			if (onReviewSubmitted) {
				onReviewSubmitted(result.data);
			}
		} else {
			toast.error('Failed to submit review.', { description: result.error });
		}
	}

	$effect(() => {
		return () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		};
	});
</script>

{#if grievance.review}
	{@const review = grievance.review}
	<Card class="border">
		<CardHeader class="pb-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class="size-7 rounded-md bg-foreground text-background flex items-center justify-center">
						<CheckCircle2Icon class="size-4" />
					</div>
					<div>
						<CardTitle class="text-base font-bold">Verified Solution Review</CardTitle>
						<CardDescription class="text-xs">
							Submitted by {review.student?.name ?? grievance.student.name} on {formatDate(review.createdAt)}
						</CardDescription>
					</div>
				</div>
				<div class="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md border text-xs">
					<div class="flex items-center">
						{#each [1, 2, 3, 4, 5] as star}
							<StarIcon
								class="size-3.5 {star <= review.rating ? 'fill-foreground text-foreground' : 'text-muted-foreground stroke-1'}"
							/>
						{/each}
					</div>
					<span class="font-bold text-foreground font-mono">{review.rating}/5</span>
				</div>
			</div>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="bg-muted/40 p-3.5 rounded-lg border text-sm leading-relaxed">
				<p class="text-foreground whitespace-pre-wrap">{review.feedback}</p>
			</div>

			{#if review.solutionAttachment}
				<div>
					<h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
						<ImageIcon class="size-3.5" />
						Proof of Solution (Uploaded Photo)
					</h4>
					<div class="border rounded-lg p-2 max-w-sm bg-muted/20">
						<a
							href="/api/attachments/{review.solutionAttachment.id}"
							target="_blank"
							rel="noreferrer"
							class="group relative block overflow-hidden rounded-md border bg-black/5"
						>
							<img
								src="/api/attachments/{review.solutionAttachment.id}"
								alt="Proof of resolution for {grievance.id}"
								class="h-48 w-full object-cover transition-transform duration-200 group-hover:scale-105"
								loading="lazy"
							/>
							<div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
								<span class="inline-flex items-center gap-1.5 text-xs text-white font-medium bg-black/70 px-2.5 py-1 rounded">
									<ExternalLinkIcon class="size-3.5" />
									View Full Image
								</span>
							</div>
						</a>
						<div class="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1">
							<span class="truncate max-w-50">{review.solutionAttachment.filename}</span>
							<span class="font-mono text-[11px]">{(review.solutionAttachment.sizeBytes / 1024).toFixed(1)} KB</span>
						</div>
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>
{:else if grievance.status === 'Resolved'}
	{#if isOwner}
		<Card class="border">
			<CardHeader class="pb-3">
				<div class="flex items-center gap-2">
					<div class="size-7 rounded-md bg-muted text-foreground flex items-center justify-center border">
						<CheckCircle2Icon class="size-4" />
					</div>
					<div>
						<CardTitle class="text-base font-bold">Resolution Review & Solution Photo</CardTitle>
						<CardDescription class="text-xs">
							This grievance is marked as Resolved. Please verify the solution and post your feedback.
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<form onsubmit={handleSubmit} class="space-y-4">
					<div class="space-y-1.5">
						<Label class="text-xs font-semibold text-foreground">Satisfaction Rating *</Label>
						<div class="flex items-center gap-3">
							<div class="flex items-center gap-1">
								{#each [1, 2, 3, 4, 5] as star}
									<button
										type="button"
										class="p-1 transition-transform hover:scale-110 focus:outline-none"
										onmouseenter={() => (hoverRating = star)}
										onmouseleave={() => (hoverRating = 0)}
										onclick={() => (rating = star)}
										aria-label="Rate {star} stars"
									>
										<StarIcon
											class="size-5 transition-colors {star <= (hoverRating || rating)
												? 'fill-foreground text-foreground'
												: 'text-muted-foreground stroke-1'}"
										/>
									</button>
								{/each}
							</div>
							<span class="text-xs text-muted-foreground font-medium">
								{ratingLabels[hoverRating || rating]}
							</span>
						</div>
					</div>

					<div class="space-y-1.5">
						<Label for="solution-file" class="text-xs font-semibold text-foreground">
							Picture of Completed Solution *
						</Label>
						{#if !selectedFile}
							<label
								for="solution-file"
								class="flex flex-col items-center justify-center rounded-lg border border-dashed border-input bg-muted/20 p-6 text-center hover:bg-muted/40 cursor-pointer transition-colors"
							>
								<UploadCloudIcon class="size-8 text-muted-foreground mb-2" />
								<p class="text-xs font-medium text-foreground">Click to upload photo of the fix</p>
								<p class="text-[11px] text-muted-foreground mt-0.5">PNG, JPG, WebP up to 5MB</p>
								<input
									id="solution-file"
									type="file"
									accept="image/png,image/jpeg,image/gif,image/webp"
									class="sr-only"
									onchange={handleFileChange}
									required
								/>
							</label>
						{:else}
							<div class="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
								{#if previewUrl}
									<img src={previewUrl} alt="Preview" class="size-16 object-cover rounded border" />
								{/if}
								<div class="min-w-0 flex-1">
									<p class="text-xs font-medium text-foreground truncate">{selectedFile.name}</p>
									<p class="text-[11px] text-muted-foreground font-mono">{(selectedFile.size / 1024).toFixed(1)} KB</p>
								</div>
								<Button type="button" variant="ghost" size="sm" class="h-8 px-2" onclick={removeFile}>
									<XIcon class="size-4" />
								</Button>
							</div>
						{/if}
					</div>

					<div class="space-y-1.5">
						<Label for="review-feedback" class="text-xs font-semibold text-foreground">
							Feedback / Review Details *
						</Label>
						<Textarea
							id="review-feedback"
							placeholder="Describe how well the issue was resolved and any remarks..."
							bind:value={feedback}
							rows={3}
							class="text-sm"
							required
						/>
					</div>

					<Button type="submit" disabled={submitting} class="w-full">
						{submitting ? 'Submitting Review…' : 'Submit Verified Review & Picture'}
					</Button>
				</form>
			</CardContent>
		</Card>
	{:else}
		<Card class="border border-dashed bg-muted/20">
			<CardContent class="py-4 flex items-center gap-3 text-xs text-muted-foreground">
				<ClockIcon class="size-4 shrink-0 text-foreground" />
				<span>Awaiting student post-resolution review and solution photo verification.</span>
			</CardContent>
		</Card>
	{/if}
{/if}
