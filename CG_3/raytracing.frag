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
    // 0 - non-reflection, 1 - mirror
    float ReflectionCoef;
    float RefractionCoef;
    int MaterialType;
};

struct SMaterial {
    vec3 Color;
    // ambient, diffuse and specular coeffs
    vec4 LightCoeffs;
    // 0 - non-reflection, 1 - mirror
    float ReflectionCoef;
    float RefractionCoef;
    int MaterialType;
};

struct SLight
{
    vec3 Position;
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
    return StackSize <=0;
}

/*** GLOBALS ***/
#define EPSILON 0.001
#define BIG 1000000.0

const int DIFFUSE_REFLECTION = 1;
const int MIRROR_REFLECTION = 2;
const int REFRACTION = 3;

SCamera uCamera;
SMaterial materials[6];
SLight light;
STriangle triangles[10];
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
    camera.Position = vec3(0.0, 0.0, -8.0);
    camera.View = vec3(0.0, 0.0, 1.0);
    camera.Up = vec3(0.0, 1.0, 0.0);
    camera.Side = vec3(1.0, 0.0, 0.0);
    camera.Scale = vec2(1.0);
    return camera;
}

void InitializeDefaultScene() {

    /** TRIANGLES **/
    /* left wall */
    triangles[0].v1 = vec3(-5.0, -5.0, -5.0);
    triangles[0].v2 = vec3(-5.0, -5.0, 5.0);
    triangles[0].v3 = vec3(-5.0, 5.0, -5.0);
    triangles[0].MaterialIdx = 1;

    triangles[1].v1 = vec3(-5.0, 5.0, 5.0);
    triangles[1].v2 = vec3(-5.0, -5.0, 5.0);
    triangles[1].v3 = vec3(-5.0, 5.0, -5.0);
    triangles[1].MaterialIdx = 1;

    /* right wall */
    triangles[2].v1 = vec3(5.0, -5.0, -5.0);
    triangles[2].v2 = vec3(5.0, -5.0, 5.0);
    triangles[2].v3 = vec3(5.0, 5.0, -5.0);
    triangles[2].MaterialIdx = 0;

    triangles[3].v1 = vec3(5.0, 5.0, 5.0);
    triangles[3].v2 = vec3(5.0, -5.0, 5.0);
    triangles[3].v3 = vec3(5.0, 5.0, -5.0);
    triangles[3].MaterialIdx = 0;

    /* up wall */
    triangles[4].v1 = vec3(-5.0, 5.0, -5.0);
    triangles[4].v2 = vec3(-5.0, 5.0, 5.0);
    triangles[4].v3 = vec3(5.0, 5.0, -5.0);
    triangles[4].MaterialIdx = 0;

    triangles[5].v1 = vec3(5.0, 5.0, 5.0);
    triangles[5].v2 = vec3(-5.0, 5.0, 5.0);
    triangles[5].v3 = vec3(5.0, 5.0, -5.0);
    triangles[5].MaterialIdx = 0;

    /* down wall */
    triangles[6].v1 = vec3(-5.0, -5.0, -5.0);
    triangles[6].v2 = vec3(-5.0, -5.0, 5.0);
    triangles[6].v3 = vec3(5.0, -5.0, -5.0);
    triangles[6].MaterialIdx = 0;

    triangles[7].v1 = vec3(5.0, -5.0, 5.0);
    triangles[7].v2 = vec3(-5.0, -5.0, 5.0);
    triangles[7].v3 = vec3(5.0, -5.0, -5.0);
    triangles[7].MaterialIdx = 0;

    /* front wall */
    triangles[8].v1 = vec3(-5.0, -5.0, 5.0);
    triangles[8].v2 = vec3(-5.0, 5.0, 5.0);
    triangles[8].v3 = vec3(5.0, -5.0, 5.0);
    triangles[8].MaterialIdx = 0;

    triangles[9].v1 = vec3(5.0, 5.0, 5.0);
    triangles[9].v2 = vec3(-5.0, 5.0, 5.0);
    triangles[9].v3 = vec3(5.0, -5.0, 5.0);
    triangles[9].MaterialIdx = 0;


    /** SPHERES **/
    spheres[0].Center = vec3(-1.0, -1.0, -2.0);
    spheres[0].Radius = 2.0;
    spheres[0].MaterialIdx = 0;

    spheres[1].Center = vec3(2.0, 1.0, 2.0);
    spheres[1].Radius = 1.0;
    spheres[1].MaterialIdx = 0;
}

void InitializeDefaultLightMaterials() {
    //** LIGHT **//
    light.Position = vec3(0.0, 2.0, -4.0f);
    /** MATERIALS **/
    vec4 lightCoefs = vec4(0.4, 0.9, 0.0, 512.0);
    materials[0].Color = vec3(0.0, 1.0, 0.0);
    materials[0].LightCoeffs = lightCoefs;
    materials[0].ReflectionCoef = 1.0;
    materials[0].RefractionCoef = 1.0;
    materials[0].MaterialType = DIFFUSE_REFLECTION;

    materials[1].Color = vec3(0.0, 0.0, 1.0);
    materials[1].LightCoeffs = lightCoefs;
    materials[1].ReflectionCoef = 0.0;
    materials[1].RefractionCoef = 0.0;
    materials[1].MaterialType = DIFFUSE_REFLECTION;
}

SRay GenerateRay() {
    vec2 coords = glPosition.xy * uCamera.Scale;
    vec3 direction = uCamera.View + uCamera.Side * coords.x + uCamera.Up * coords.y;
    return SRay(uCamera.Position, normalize(direction));
}

bool Raytrace(SRay ray, float start, float final, inout SIntersection intersect) {
    bool result = false;
    float test = start;
    intersect.Time = final;
    //calculate intersect with spheres
    for (int i = 0; i < 2; i++) {
        SSphere sphere = spheres[i];
        if (IntersectSphere(sphere, ray, start, final, test) && test < intersect.Time) {
            intersect.Time = test;
            intersect.Point = ray.Origin + ray.Direction * test;
            intersect.Normal = normalize(intersect.Point - spheres[i].Center);
            intersect.Color = vec3(1, 0, 0);
            intersect.LightCoeffs = vec4(0, 0, 0, 0);
            intersect.ReflectionCoef = 0;
            intersect.RefractionCoef = 0;
            intersect.MaterialType = DIFFUSE_REFLECTION;
            result = true;
        }
    }
    //calculate intersect with triangles
    for (int i = 0; i < 10; i++) {
        if (IntersectTriangle(ray, triangles[i], test) && test < intersect.Time) {
            intersect.Time = test;
            intersect.Point = ray.Origin + ray.Direction * test;
            intersect.Normal = normalize(cross(triangles[i].v1 - triangles[i].v2,
                triangles[i].v3 - triangles[i].v2));
            intersect.Color = vec3(1, 0, 0);
            intersect.LightCoeffs = vec4(0, 0, 0, 0);
            intersect.ReflectionCoef = 0;
            intersect.RefractionCoef = 0;
            intersect.MaterialType = DIFFUSE_REFLECTION;
            result = true;
        }
    }
    return result;
}

vec3 Phong(SIntersection intersect, SLight currLight, float shadow) {
    vec3 light = normalize(currLight.Position - intersect.Point);
    float diffuse = max(dot(light, intersect.Normal), 0.0);
    vec3 view = normalize(uCamera.Position - intersect.Point);
    vec3 reflected = reflect(-view, intersect.Normal);
    float specular = pow(max(dot(reflected, light), 0.0), intersect.LightCoeffs.w);
    return intersect.LightCoeffs.x * intersect.Color +
        intersect.LightCoeffs.y * diffuse * intersect.Color * shadow +
        intersect.LightCoeffs.z * specular;
}

float Shadow(SLight curLight, SIntersection intersect) {
    // Point is lighted
    float shadowing = 1.0;
    // Vector to the light source
    vec3 direction = normalize(curLight.Position - intersect.Point);
    // Distance to the light source
    float distanceLight = distance(curLight.Position, intersect.Point);
    // Generation shadow ray for this light source
    SRay shadowRay = SRay(intersect.Point + direction * EPSILON, direction);
    // ...test intersection this ray with each scene object
    SIntersection shadowIntersect;
    shadowIntersect.Time = BIG;
    // trace ray from shadow ray begining to light source position
    if (Raytrace(shadowRay, 0, distanceLight, shadowIntersect)) {
    // this light source is invisible in the intercection point
        if (shadowIntersect.MaterialType != REFRACTION)
            shadowing = 0.0;
    }
    return shadowing;
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
            switch (intersect.MaterialType)
            {
            case DIFFUSE_REFLECTION: {
                float shadowing = Shadow(light, intersect);
                resultColor += curRay.Contrib * Phong(intersect, light, shadowing);
                break;
            }
            case MIRROR_REFLECTION: {
                if (intersect.ReflectionCoef < 1) {
                    float contribution = curRay.Contrib * (1 - intersect.ReflectionCoef);
                    float shadowing = Shadow(light, intersect);
                    resultColor += contribution * Phong(intersect, light, shadowing);
                }
                vec3 reflectDirection = reflect(ray.Direction, intersect.Normal);
                // creare reflection ray
                float contribution = curRay.Contrib * intersect.ReflectionCoef;
                STracingRay reflectRay = STracingRay(
                    SRay(intersect.Point + reflectDirection * EPSILON, reflectDirection),
                    contribution, curRay.Depth + 1);
                if (reflectRay.Depth < 100)
                    PushRay(reflectRay);
                break;
            }
            }
        }
    }
    FragColor = vec4(resultColor, 1.0);
}
