#version 430

out vec4 FragColor;
in vec3 glPosition;

/*** DATA STRUCTURES ***/
struct SCamera {
    vec3 Position;
    vec3 View;
    vec3 Up;
    vec3 Side;
    // aspect ratio
    vec2 Scale;
};

struct SRay {
    vec3 Origin;
    vec3 Direction;
    float RefractIndice;
};

struct STracingRay
{
    SRay Ray;
    float Contrib;
    int Depth;
};

struct SIntersection {
    float Time;
    vec3 Point;
    vec3 Normal;
    vec3 Color;
    // ambient, diffuse and specular coeffs
    vec4 LightCoeffs;
    float ReflectionCoef;
    float RefractionCoef;
    float RefractIndice;
};

struct SMaterial {
    vec3 Color;
    // ambient, diffuse and specular coeffs
    vec4 LightCoeffs;
    float ReflectionCoef;
    float RefractionCoef;
    float RefractIndice;
};

struct SLight
{
    vec3 Position;
    vec3 Color;
    float Intensity;
};

struct STriangle {
    vec3 v1;
    vec3 v2;
    vec3 v3;
    int MaterialIdx;
};

struct SSphere {
    vec3 Center;
    float Radius;
    int MaterialIdx;
};


/*** RAY STACK ***/
STracingRay Stack[100];
int StackSize = 0;

void PushRay(STracingRay ray) {
    Stack[StackSize++] = ray;
}

STracingRay PopRay() {
    return Stack[--StackSize];
}

bool IsEmpty() {
    return StackSize <= 0;
}

/*** GLOBALS ***/
#define EPSILON 0.001
#define BIG 1000000.0

int TraceDepth = 100;

SCamera uCamera;
SMaterial materials[8];
SLight lights[2];
STriangle triangles[16];
SSphere spheres[2];

/*** INTERSECTIONS ***/
bool IntersectSphere(SSphere sphere, SRay ray, float start, float final, out float time) {
    ray.Origin -= sphere.Center;
    float A = dot(ray.Direction, ray.Direction);
    float B_2 = dot(ray.Direction, ray.Origin);
    float C = dot(ray.Origin, ray.Origin) - sphere.Radius * sphere.Radius;
    float D_4 = B_2 * B_2 - A * C;
    if (D_4 > 0.0) {
        D_4 = sqrt(D_4);
        float t1 = (-B_2 - D_4) / A;
        float t2 = (-B_2 + D_4) / A;
        if (t1 > t2) {
            float tmp = t1;
            t1 = t2;
            t2 = t1;
        }
        if (t2 < 0)
            return false;
        if (t1 < 0) {
            time = t2;
            return true;
        }
        time = t1;
        return true;
    }
    return false;
}

bool IntersectTriangle(SRay ray, STriangle triangle, out float time) {
    vec3 A = triangle.v2 - triangle.v1;
    vec3 B = triangle.v3 - triangle.v1;
    vec3 N = cross(A, B);
    float NdotRayDirection = dot(N, ray.Direction);
    if (abs(NdotRayDirection) < 0.001)
        return false;
    float d = dot(N, triangle.v1);
    float t = -(dot(N, ray.Origin) - d) / NdotRayDirection;
    if (t < 0)
        return false;

    vec3 P = ray.Origin + t * ray.Direction;
    vec3 edge1 = triangle.v2 - triangle.v1;
    vec3 C = cross(edge1, P - triangle.v1);
    if (dot(N, C) < 0)
        return false;
    vec3 edge2 = triangle.v3 - triangle.v2;
    C = cross(edge2, P - triangle.v2);
    if (dot(N, C) < 0)
        return false;
    vec3 edge3 = triangle.v1 - triangle.v3;
    C = cross(edge3, P - triangle.v3);
    if (dot(N, C) < 0)
        return false;
    time = t;
    return true;
}


/*** FUNCTIONS ***/
SCamera InitializeDefaultCamera() {
    //** CAMERA **//
    SCamera camera;
    camera.Position = vec3(1.0, 0.0, -4.99);
    camera.View = vec3(0.0, 0.0, 1.0);
    camera.Up = vec3(0.0, 1.0, 0.0);
    camera.Side = vec3(1.778, 0.0, 0.0);
    float mult = 1.0;
    camera.Scale = vec2(mult * 1.0, mult * 1.0);
    return camera;
}

void InitializeDefaultScene() {

    /** TRIANGLES **/
    /* left wall */
    triangles[0].v1 = vec3(-5.0, -5.0, -5.0);
    triangles[0].v2 = vec3(-5.0, -5.0, 5.0);
    triangles[0].v3 = vec3(-5.0, 5.0, -5.0);
    triangles[0].MaterialIdx = 0;

    triangles[1].v1 = vec3(-5.0, 5.0, 5.0);
    triangles[1].v2 = vec3(-5.0, 5.0, -5.0);
    triangles[1].v3 = vec3(-5.0, -5.0, 5.0);
    triangles[1].MaterialIdx = 0;

    /* right wall */
    triangles[2].v1 = vec3(5.0, -5.0, -5.0);
    triangles[2].v2 = vec3(5.0, 5.0, -5.0);
    triangles[2].v3 = vec3(5.0, -5.0, 5.0);
    triangles[2].MaterialIdx = 6;

    triangles[3].v1 = vec3(5.0, 5.0, 5.0);
    triangles[3].v2 = vec3(5.0, -5.0, 5.0);
    triangles[3].v3 = vec3(5.0, 5.0, -5.0);
    triangles[3].MaterialIdx = 6;

    /* up wall */
    triangles[4].v1 = vec3(-5.0, 5.0, -5.0);
    triangles[4].v2 = vec3(-5.0, 5.0, 5.0);
    triangles[4].v3 = vec3(5.0, 5.0, -5.0);
    triangles[4].MaterialIdx = 2;

    triangles[5].v1 = vec3(5.0, 5.0, 5.0);
    triangles[5].v2 = vec3(5.0, 5.0, -5.0);
    triangles[5].v3 = vec3(-5.0, 5.0, 5.0);
    triangles[5].MaterialIdx = 2;

    /* down wall */
    triangles[6].v1 = vec3(-5.0, -5.0, -5.0);
    triangles[6].v2 = vec3(5.0, -5.0, -5.0);
    triangles[6].v3 = vec3(-5.0, -5.0, 5.0);
    triangles[6].MaterialIdx = 3;

    triangles[7].v1 = vec3(5.0, -5.0, 5.0);
    triangles[7].v2 = vec3(-5.0, -5.0, 5.0);
    triangles[7].v3 = vec3(5.0, -5.0, -5.0);
    triangles[7].MaterialIdx = 3;

    /* front wall */
    triangles[8].v1 = vec3(-5.0, -5.0, 5.0);
    triangles[8].v2 = vec3(5.0, -5.0, 5.0);
    triangles[8].v3 = vec3(-5.0, 5.0, 5.0);
    triangles[8].MaterialIdx = 1;

    triangles[9].v1 = vec3(5.0, 5.0, 5.0);
    triangles[9].v2 = vec3(-5.0, 5.0, 5.0);
    triangles[9].v3 = vec3(5.0, -5.0, 5.0);
    triangles[9].MaterialIdx = 1;

    /* back wall */
    triangles[10].v1 = vec3(-5.0, -5.0, -5.0);
    triangles[10].v2 = vec3(-5.0, 5.0, -5.0);
    triangles[10].v3 = vec3(5.0, -5.0, -5.0);
    triangles[10].MaterialIdx = 5;

    triangles[11].v1 = vec3(5.0, 5.0, -5.0);
    triangles[11].v2 = vec3(5.0, -5.0, -5.0);
    triangles[11].v3 = vec3(-5.0, 5.0, -5.0);
    triangles[11].MaterialIdx = 5;


    /** SPHERES **/
    spheres[0].Center = vec3(-2.0, -1.0, -1.0);
    spheres[0].Radius = 2.0;
    spheres[0].MaterialIdx = 7;

    spheres[1].Center = vec3(2.0, 1.0, 2.0);
    spheres[1].Radius = 1.0;
    spheres[1].MaterialIdx = 6;

    /** TETRAHEDRON **/
    triangles[12].v2 = vec3(2, -4.0, -0.5);
    triangles[12].v1 = vec3(0, -4.0, 3);
    triangles[12].v3 = vec3(4, -4.0, 3);
    triangles[12].MaterialIdx = 6;

    triangles[13].v2 = vec3(2, -0.5, 1.75);
    triangles[13].v1 = vec3(0, -4.0, 3);
    triangles[13].v3 = vec3(4, -4.0, 3);
    triangles[13].MaterialIdx = 6;

    triangles[14].v1 = vec3(2, -4.0, -0.5);
    triangles[14].v2 = vec3(2, -0.5, 1.75);
    triangles[14].v3 = vec3(4, -4.0, 3);
    triangles[14].MaterialIdx = 6;

    triangles[15].v2 = vec3(2, -4.0, -0.5);
    triangles[15].v1 = vec3(0, -4.0, 3);
    triangles[15].v3 = vec3(2, -0.5, 1.75);
    triangles[15].MaterialIdx = 6;
}

void InitializeDefaultLightMaterials() {
    //** LIGHTS **//
    lights[0].Position = vec3(4.0, 3.0, -2.0);
    lights[0].Color = vec3(1.0, 1.0, 0.82);
    lights[0].Intensity = 0.6;

    lights[1].Position = vec3(-3.0, -2.0, -4.0);
    lights[1].Color = vec3(1.0, 0.85, 0.7);
    lights[1].Intensity = 0.3;

    /** MATERIALS **/
    vec4 lightCoeffs = vec4(0.4, 0.9, 0.2, 512.0);
    materials[0].Color = vec3(0.715, 0.109, 0.109);
    materials[0].LightCoeffs = lightCoeffs;
    materials[0].ReflectionCoef = 0.0;
    materials[0].RefractionCoef = 0.0;
    materials[0].RefractIndice = 1.0;

    materials[1].Color = vec3(0.645, 0.836, 0.652);
    materials[1].LightCoeffs = lightCoeffs;
    materials[1].ReflectionCoef = 0.0;
    materials[1].RefractionCoef = 0.0;
    materials[1].RefractIndice = 1.0;

    materials[2].Color = vec3(0.621, 0.656, 0.852);
    materials[2].LightCoeffs = lightCoeffs;
    materials[2].ReflectionCoef = 0.0;
    materials[2].RefractionCoef = 0.0;
    materials[2].RefractIndice = 1.0;

    materials[3].Color = vec3(1.0, 1.0, 0.0);
    materials[3].LightCoeffs = lightCoeffs;
    materials[3].ReflectionCoef = 0.0;
    materials[3].RefractionCoef = 0.0;
    materials[3].RefractIndice = 1.0;

    materials[4].Color = vec3(0.0, 1.0, 1.0);
    materials[4].LightCoeffs = lightCoeffs;
    materials[4].ReflectionCoef = 0.0;
    materials[4].RefractionCoef = 0.0;
    materials[4].RefractIndice = 1.0;

    materials[5].Color = vec3(1.0, 0.0, 1.0);
    materials[5].LightCoeffs = lightCoeffs;
    materials[5].ReflectionCoef = 0.0;
    materials[5].RefractionCoef = 0.0;
    materials[5].RefractIndice = 1.0;

    materials[6].Color = vec3(1.0, 1.0, 1.0);
    materials[6].LightCoeffs = vec4(0.2, 0.5, 0.9, 1024.0);
    materials[6].ReflectionCoef = 0.8;
    materials[6].RefractionCoef = 0.0;
    materials[6].RefractIndice = 1.0;

    materials[7].Color = vec3(1.0, 1.0, 1.0);
    materials[7].LightCoeffs = vec4(0.2, 0.5, 0.9, 16.0);
    materials[7].ReflectionCoef = 0.0;
    materials[7].RefractionCoef = 0.7;
    materials[7].RefractIndice = 2.0;
}

SRay GenerateRay() {
    vec2 coords = glPosition.xy * uCamera.Scale;
    vec3 direction = uCamera.View + uCamera.Side * coords.x + uCamera.Up * coords.y;
    return SRay(uCamera.Position, normalize(direction), 1.0);
}

bool Raytrace(SRay ray, float start, float final, inout SIntersection intersect) {
    bool result = false;
    float test = start;
    intersect.Time = final;
    //calculate intersect with spheres
    for (int i = 0; i < 2; ++i) {
        SSphere sphere = spheres[i];
        if (IntersectSphere(sphere, ray, start, final, test) && test < intersect.Time) {
            intersect.Time = test;
            intersect.Point = ray.Origin + ray.Direction * test;
            intersect.Normal = normalize(intersect.Point - spheres[i].Center);

            SMaterial curMat = materials[spheres[i].MaterialIdx];
            intersect.Color = curMat.Color;
            intersect.LightCoeffs = curMat.LightCoeffs;
            intersect.ReflectionCoef = curMat.ReflectionCoef;
            intersect.RefractionCoef = curMat.RefractionCoef;
            if (dot(ray.Direction, intersect.Normal) > 0) {
                intersect.Normal = -intersect.Normal;
                intersect.RefractIndice = 1.0;
            } else {
                intersect.RefractIndice = curMat.RefractIndice;
            }
            result = true;
        }
    }
    //calculate intersect with triangles
    for (int i = 0; i < 16; ++i) {
        if (IntersectTriangle(ray, triangles[i], test) && test < intersect.Time) {
            intersect.Time = test;
            intersect.Point = ray.Origin + ray.Direction * test;
            intersect.Normal = normalize(cross(triangles[i].v1 - triangles[i].v2,
                triangles[i].v3 - triangles[i].v2));

            SMaterial curMat = materials[triangles[i].MaterialIdx];
            intersect.Color = curMat.Color;
            intersect.LightCoeffs = curMat.LightCoeffs;
            intersect.ReflectionCoef = curMat.ReflectionCoef;
            intersect.RefractionCoef = curMat.RefractionCoef;
            intersect.RefractIndice = 1.0;
            result = true;
        }
    }
    return result;
}

float Shadow(SIntersection intersect, int lightNumber) {
    // Point is lighted
    float shadowing = 1.0;
    // Vector to the light source
    vec3 direction = normalize(lights[lightNumber].Position - intersect.Point);
    // Distance to the light source
    float distanceLight = distance(lights[lightNumber].Position, intersect.Point);
    // Generation shadow ray for this light source
    SRay shadowRay = SRay(intersect.Point + direction * EPSILON, direction, 1.0);
    // ...test intersection this ray with each scene object
    SIntersection shadowIntersect;
    shadowIntersect.Time = BIG;
    // trace ray from shadow ray begining to light source position
    if (Raytrace(shadowRay, 0, distanceLight, shadowIntersect)) {
        // this light source is invisible in the intercection point
        shadowing = 0.0;
    }
    return shadowing;
}

vec3 Phong(SIntersection intersect) {
    vec3 result = vec3(0.0, 0.0, 0.0);
    for (int i = 0; i < 2; ++i) {
        vec3 light = normalize(lights[i].Position - intersect.Point);
        float diffuse = max(dot(light, intersect.Normal), 0.0);
        vec3 view = normalize(uCamera.Position - intersect.Point);
        vec3 reflected = reflect(-view, intersect.Normal);
        float specular = pow(max(dot(reflected, light), 0.0), intersect.LightCoeffs.w);
        result += lights[i].Intensity * (intersect.LightCoeffs.x * intersect.Color * lights[i].Color +
            intersect.LightCoeffs.y * diffuse * intersect.Color * lights[i].Color * Shadow(intersect, i) +
            intersect.LightCoeffs.z * specular);
    }
    return result;
}

void main(void)
{
    uCamera = InitializeDefaultCamera();
    SRay ray = GenerateRay();

    SIntersection intersect;
    intersect.Time = BIG;
    vec3 resultColor = vec3(0, 0, 0);

    InitializeDefaultScene();
    InitializeDefaultLightMaterials();

    STracingRay curRay = STracingRay(ray, 1, 0);
    PushRay(curRay);
    while (StackSize > 0) {
        curRay = PopRay();
        ray = curRay.Ray;
        SIntersection intersect;
        float start = 0;
        float final = BIG;

        if (Raytrace(ray, start, final, intersect)) {
            float contribution = curRay.Contrib * (1.0 - intersect.ReflectionCoef - intersect.RefractionCoef);
            resultColor += contribution * Phong(intersect);

            if (intersect.ReflectionCoef > 0) {
                vec3 reflectDirection = reflect(ray.Direction, intersect.Normal);
                float contribution = curRay.Contrib * intersect.ReflectionCoef;
                STracingRay reflectRay = STracingRay(
                    SRay(intersect.Point + reflectDirection * EPSILON, reflectDirection, 1.0),
                    contribution, curRay.Depth + 1);
                if (reflectRay.Depth < TraceDepth)
                    PushRay(reflectRay);
            }
            if (intersect.RefractionCoef > 0) {
                vec3 refractionDirection = refract(
                    ray.Direction, intersect.Normal, ray.RefractIndice / intersect.RefractIndice);
                float contribution = curRay.Contrib * intersect.RefractionCoef;
                STracingRay refractRay = STracingRay(
                    SRay(intersect.Point + refractionDirection * EPSILON, refractionDirection,
                        intersect.RefractIndice),
                    contribution, curRay.Depth + 1);
                if (refractRay.Depth < TraceDepth)
                    PushRay(refractRay);
            }
        }
    }
    FragColor = vec4(resultColor, 1.0);
}
