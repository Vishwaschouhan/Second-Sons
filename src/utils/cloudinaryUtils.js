export const uploadToCloudinary = async (file) => {
    const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
        throw new Error('Cloudinary config missing');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
            method: 'POST',
            body: formData,
        }
    );

    const data = await res.json();
    if (data.error) {
        throw new Error(data.error.message || 'Cloudinary upload failed');
    }
    return data.secure_url;
};
